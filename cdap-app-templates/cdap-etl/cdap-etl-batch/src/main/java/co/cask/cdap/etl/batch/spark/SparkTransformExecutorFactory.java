/*
 * Copyright © 2016 Cask Data, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */

package co.cask.cdap.etl.batch.spark;

import co.cask.cdap.api.dataset.lib.KeyValue;
import co.cask.cdap.api.metrics.Metrics;
import co.cask.cdap.api.plugin.PluginContext;
import co.cask.cdap.api.workflow.WorkflowToken;
import co.cask.cdap.etl.api.Aggregator;
import co.cask.cdap.etl.api.Emitter;
import co.cask.cdap.etl.api.StageMetrics;
import co.cask.cdap.etl.api.Transformation;
import co.cask.cdap.etl.api.batch.BatchAggregator;
import co.cask.cdap.etl.api.batch.BatchRuntimeContext;
import co.cask.cdap.etl.api.batch.SparkCompute;
import co.cask.cdap.etl.api.batch.SparkSink;
import co.cask.cdap.etl.batch.PipelinePluginInstantiator;
import co.cask.cdap.etl.batch.TransformExecutorFactory;
import co.cask.cdap.etl.common.DefaultEmitter;
import co.cask.cdap.etl.common.DefaultMacroEvaluator;
import co.cask.cdap.etl.common.DefaultStageMetrics;
import co.cask.cdap.etl.common.TrackedTransform;
import scala.Tuple2;

import java.util.Map;

/**
 * Creates transform executors for spark programs.
 *
 * @param <T> the type of input for the created transform executors
 */
public class SparkTransformExecutorFactory<T> extends TransformExecutorFactory<T> {
  private static final Transformation IDENTITY_TRANSFORMATION = new Transformation() {
    @Override
    public void transform(Object input, Emitter emitter) throws Exception {
      emitter.emit(input);
    }
  };

  private final PluginContext pluginContext;
  private final long logicalStartTime;
  private final Map<String, String> runtimeArgs;
  // whether this is before the group step of an aggregator, or before a spark compute stage
  private final boolean isFirstHalf;
  private final WorkflowToken workflowToken;

  public SparkTransformExecutorFactory(PluginContext pluginContext,
                                       PipelinePluginInstantiator pluginInstantiator,
                                       Metrics metrics, long logicalStartTime,
                                       Map<String, String> runtimeArgs,
                                       boolean isFirstHalf, String sourceStageName,
                                       WorkflowToken workflowToken) {
    super(pluginInstantiator, metrics, sourceStageName,
          new DefaultMacroEvaluator(workflowToken, runtimeArgs, logicalStartTime));
    this.pluginContext = pluginContext;
    this.logicalStartTime = logicalStartTime;
    this.runtimeArgs = runtimeArgs;
    this.isFirstHalf = isFirstHalf;
    this.workflowToken = workflowToken;
  }

  @Override
  protected BatchRuntimeContext createRuntimeContext(String stageName) {
    return new SparkBatchRuntimeContext(pluginContext, metrics, logicalStartTime, runtimeArgs, stageName);
  }

  @SuppressWarnings("unchecked")
  @Override
  protected TrackedTransform getTransformation(String pluginType, String stageName) throws Exception {
    StageMetrics stageMetrics = new DefaultStageMetrics(metrics, stageName);
    if (BatchAggregator.PLUGIN_TYPE.equals(pluginType)) {
      BatchAggregator<?, ?, ?> batchAggregator = pluginInstantiator.newPluginInstance(
        stageName, new DefaultMacroEvaluator(workflowToken, runtimeArgs, logicalStartTime));
      BatchRuntimeContext runtimeContext = createRuntimeContext(stageName);
      batchAggregator.initialize(runtimeContext);
      if (isFirstHalf) {
        return getTrackedEmitKeyStep(new PreGroupAggregatorTransformation(batchAggregator), stageMetrics);
      } else {
        return getTrackedAggregateStep(new PostGroupAggregatorTransformation(batchAggregator), stageMetrics);
      }
    } else if (SparkSink.PLUGIN_TYPE.equals(pluginType)) {
      // if this plugin type is a SparkSink or SparkCompute, substitute in an IDENTITY_TRANSFORMATION
      return  new TrackedTransform(IDENTITY_TRANSFORMATION, stageMetrics, TrackedTransform.RECORDS_IN, null);
    } else if (SparkCompute.PLUGIN_TYPE.equals(pluginType)) {
      // if this is source -> sparkcompute, then its before the break. In that case, we only want to emit records in
      // if this is sparkcompute -> sink, then its after the break. In that case, we only want to emit records out
      return isFirstHalf ?
        new TrackedTransform(IDENTITY_TRANSFORMATION, stageMetrics, TrackedTransform.RECORDS_IN, null) :
        new TrackedTransform(IDENTITY_TRANSFORMATION, stageMetrics, TrackedTransform.RECORDS_OUT, null);
    }
    return super.getTransformation(pluginType, stageName);
  }

  /**
   * A Transformation that uses an aggregator's groupBy method to transform input records into
   * zero or more tuples where the first item is the group key and second item is the input record.
   *
   * @param <GROUP_KEY> type of group key output by the aggregator
   * @param <GROUP_VAL> type of group value used by the aggregator
   */
  private static class PreGroupAggregatorTransformation<GROUP_KEY, GROUP_VAL>
    implements Transformation<GROUP_VAL, Tuple2<GROUP_KEY, GROUP_VAL>> {
    private final Aggregator<GROUP_KEY, GROUP_VAL, ?> aggregator;
    private final DefaultEmitter<GROUP_KEY> groupKeyEmitter;

    public PreGroupAggregatorTransformation(Aggregator<GROUP_KEY, GROUP_VAL, ?> aggregator) {
      this.aggregator = aggregator;
      this.groupKeyEmitter = new DefaultEmitter<>();
    }

    @Override
    public void transform(GROUP_VAL input, Emitter<Tuple2<GROUP_KEY, GROUP_VAL>> emitter) throws Exception {
      groupKeyEmitter.reset();
      aggregator.groupBy(input, groupKeyEmitter);
      for (GROUP_KEY groupKey : groupKeyEmitter.getEntries()) {
        emitter.emit(new Tuple2<>(groupKey, input));
      }
    }
  }

  /**
   * A Transformation that uses an aggregator's aggregate method. Takes as input a key-value representing a group,
   * where the key is the group key, and the value is an iterable of group values. Transforms each group into
   * zero or more output records.
   *
   * @param <GROUP_KEY> type of group key output by the aggregator
   * @param <GROUP_VAL> type of group value used by the aggregator
   */
  private static class PostGroupAggregatorTransformation<GROUP_KEY, GROUP_VAL, OUT>
    implements Transformation<KeyValue<GROUP_KEY, Iterable<GROUP_VAL>>, OUT> {
    private final Aggregator<GROUP_KEY, GROUP_VAL, OUT> aggregator;

    public PostGroupAggregatorTransformation(Aggregator<GROUP_KEY, GROUP_VAL, OUT> aggregator) {
      this.aggregator = aggregator;
    }

    @Override
    public void transform(KeyValue<GROUP_KEY, Iterable<GROUP_VAL>> input, Emitter<OUT> emitter) throws Exception {
      aggregator.aggregate(input.getKey(), input.getValue().iterator(), emitter);
    }
  }

}
