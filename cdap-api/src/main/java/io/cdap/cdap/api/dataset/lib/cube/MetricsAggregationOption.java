/*
 * Copyright © 2019 Cask Data, Inc.
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

package io.cdap.cdap.api.dataset.lib.cube;

/**
 * The metrics aggregation option. It will reduce the number of metrics data points to the approximate count depending
 * on whether there is a remainder.
 * For example, if the metrics query result has 100 data points, and if the count is 10, then
 * each 10 of the data points will be aggregated to one single point based on the aggregation option. If there are
 * 100 points and the count is 9, then each 11 of the data points will be aggregated to one single point, and the rest
 * one data point will also become one single point, so the result will have 10 data points.
 */
public class MetricsAggregationOption {
  private final int count;
  private final AggregationOption aggregationOption;

  public MetricsAggregationOption(int count, AggregationOption aggregationOption) {
    this.count = count;
    this.aggregationOption = aggregationOption;
  }

  public int getCount() {
    return count;
  }

  public AggregationOption getAggregationOption() {
    return aggregationOption;
  }

  /**
   * The aggregation option for the data points, SUM means the values of the data points in the time interval will get
   * added together, LATEST means the last value of the data points will get used.
   */
  public enum AggregationOption {
    SUM,
    LATEST
  }
}
