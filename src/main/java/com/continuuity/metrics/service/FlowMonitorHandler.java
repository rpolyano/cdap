package com.continuuity.metrics.service;

import com.continuuity.metrics.stubs.*;

import java.util.List;

/**
 *
 */
public interface FlowMonitorHandler {
  /**
   * Adds a metric for a flow.
   *
   * @param metric to be added.
   */
  public void add(FlowMetric metric);

  /**
   * Returns list of flows and their state for a given account id.
   *
   * @param accountId specifying the flows to be returned.
   * @return list of flow state.
   */
  List<FlowState> getFlows(String accountId);

  /**
   * Returns a list of runs for a given flow.
   *
   * @param accountId for which the flows belong to.
   * @param appId  to which the flows belong to.
   * @param flowId is the id of the flow runs to be returned.
   * @return
   */
  public List<FlowRun> getFlowHistory(String accountId, String appId, String flowId);

  /**
   * Returns the flow definition.
   *
   * @param accountId
   * @param appId
   * @param flowId
   * @param versionId
   * @return
   */
  String getFlowDefinition(String accountId, String appId, String flowId, String versionId);

  List<Metric> getFlowMetric(String accountId, String app, String flow, String rid);
}
