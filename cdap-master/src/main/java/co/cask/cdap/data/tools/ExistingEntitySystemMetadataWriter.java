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

package co.cask.cdap.data.tools;

import co.cask.cdap.api.ProgramSpecification;
import co.cask.cdap.api.app.ApplicationSpecification;
import co.cask.cdap.api.data.stream.StreamSpecification;
import co.cask.cdap.api.dataset.DatasetProperties;
import co.cask.cdap.app.store.Store;
import co.cask.cdap.common.conf.CConfiguration;
import co.cask.cdap.data.dataset.SystemDatasetInstantiatorFactory;
import co.cask.cdap.data.view.ViewAdmin;
import co.cask.cdap.data2.dataset2.DatasetFramework;
import co.cask.cdap.data2.dataset2.DatasetManagementException;
import co.cask.cdap.data2.metadata.store.MetadataStore;
import co.cask.cdap.data2.metadata.system.AbstractSystemMetadataWriter;
import co.cask.cdap.data2.metadata.system.AppSystemMetadataWriter;
import co.cask.cdap.data2.metadata.system.DatasetSystemMetadataWriter;
import co.cask.cdap.data2.metadata.system.ProgramSystemMetadataWriter;
import co.cask.cdap.data2.metadata.system.StreamSystemMetadataWriter;
import co.cask.cdap.data2.metadata.system.ViewSystemMetadataWriter;
import co.cask.cdap.data2.transaction.stream.StreamAdmin;
import co.cask.cdap.proto.DatasetSpecificationSummary;
import co.cask.cdap.proto.Id;
import co.cask.cdap.proto.NamespaceMeta;
import co.cask.cdap.proto.ProgramType;
import co.cask.cdap.store.NamespaceStore;
import com.google.inject.Inject;
import org.apache.twill.filesystem.LocationFactory;

import java.util.Collection;

/**
 * Adds system metadata for existing entities prior to 3.3.
 * TODO: Remove in 3.4
 */
public class ExistingEntitySystemMetadataWriter {
  private final MetadataStore metadataStore;
  private final NamespaceStore nsStore;
  private final Store store;
  private final StreamAdmin streamAdmin;
  private final ViewAdmin viewAdmin;
  private final DatasetFramework dsFramework;
  private final SystemDatasetInstantiatorFactory dsInstantiatorFactory;

  @Inject
  ExistingEntitySystemMetadataWriter(MetadataStore metadataStore, NamespaceStore nsStore, Store store,
                                     StreamAdmin streamAdmin, ViewAdmin viewAdmin, DatasetFramework dsFramework,
                                     LocationFactory locationFactory, CConfiguration cConf) {
    this.metadataStore = metadataStore;
    this.nsStore = nsStore;
    this.store = store;
    this.streamAdmin = streamAdmin;
    this.viewAdmin = viewAdmin;
    this.dsFramework = dsFramework;
    this.dsInstantiatorFactory = new SystemDatasetInstantiatorFactory(locationFactory, this.dsFramework, cConf);
  }

  public void write() throws Exception {
    for (NamespaceMeta namespaceMeta : nsStore.list()) {
      Id.Namespace namespace = Id.Namespace.from(namespaceMeta.getName());
      writeSystemMetadataForApps(namespace);
      writeSystemMetadataForDatasets(namespace);
      writeSystemMetadataForStreams(namespace);
    }
  }

  private void writeSystemMetadataForApps(Id.Namespace namespace) {
    for (ApplicationSpecification appSpec : store.getAllApplications(namespace)) {
      Id.Application app = Id.Application.from(namespace, appSpec.getName());
      AbstractSystemMetadataWriter writer = new AppSystemMetadataWriter(metadataStore, app, appSpec);
      writer.write();
      writeSystemMetadataForPrograms(app, appSpec);
    }
  }

  private void writeSystemMetadataForPrograms(Id.Application app, ApplicationSpecification appSpec) {
    writeSystemMetadataForPrograms(app, ProgramType.FLOW, appSpec.getFlows().values());
    writeSystemMetadataForPrograms(app, ProgramType.MAPREDUCE, appSpec.getMapReduce().values());
    writeSystemMetadataForPrograms(app, ProgramType.SERVICE, appSpec.getServices().values());
    writeSystemMetadataForPrograms(app, ProgramType.SPARK, appSpec.getSpark().values());
    writeSystemMetadataForPrograms(app, ProgramType.WORKER, appSpec.getWorkers().values());
    writeSystemMetadataForPrograms(app, ProgramType.WORKFLOW, appSpec.getWorkflows().values());
  }

  private void writeSystemMetadataForPrograms(Id.Application app, ProgramType programType,
                                              Collection<? extends ProgramSpecification> programSpecs) {
    for (ProgramSpecification programSpec : programSpecs) {
      Id.Program programId = Id.Program.from(app, programType, programSpec.getName());
      AbstractSystemMetadataWriter writer = new ProgramSystemMetadataWriter(metadataStore, programId, programSpec);
      writer.write();
    }
  }

  private void writeSystemMetadataForDatasets(Id.Namespace namespace) throws DatasetManagementException {
    for (DatasetSpecificationSummary summary : dsFramework.getInstances(namespace)) {
      Id.DatasetInstance dsInstance = Id.DatasetInstance.from(namespace, summary.getName());
      DatasetProperties dsProperties = DatasetProperties.builder().addAll(summary.getProperties()).build();
      String dsType = summary.getType();
      AbstractSystemMetadataWriter writer = new DatasetSystemMetadataWriter(metadataStore, dsInstantiatorFactory,
                                                                            dsInstance, dsProperties, dsType);
      writer.write();
    }
  }

  private void writeSystemMetadataForStreams(Id.Namespace namespace) throws Exception {
    for (StreamSpecification streamSpec : store.getAllStreams(namespace)) {
      Id.Stream streamId = Id.Stream.from(namespace, streamSpec.getName());
      AbstractSystemMetadataWriter writer = new StreamSystemMetadataWriter(metadataStore, streamId,
                                                                           streamAdmin.getConfig(streamId));
      writer.write();
      for (Id.Stream.View view : streamAdmin.listViews(streamId)) {
        writer = new ViewSystemMetadataWriter(metadataStore, view, viewAdmin.get(view));
        writer.write();
      }
    }
  }
}
