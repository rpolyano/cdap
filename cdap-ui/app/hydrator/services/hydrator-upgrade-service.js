/*
 * Copyright © 2017 Cask Data, Inc.
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

class HydratorUpgradeService {
  constructor($rootScope, myPipelineApi, $state, $uibModal, HydratorPlusPlusConfigStore, HydratorPlusPlusLeftPanelStore, $q, PipelineAvailablePluginsActions, myAlertOnValium, NonStorePipelineErrorFactory) {
    this.$rootScope = $rootScope;
    this.myPipelineApi = myPipelineApi;
    this.$state = $state;
    this.$uibModal = $uibModal;
    this.HydratorPlusPlusConfigStore = HydratorPlusPlusConfigStore;
    this.leftPanelStore = HydratorPlusPlusLeftPanelStore;
    this.$q = $q;
    this.PipelineAvailablePluginsActions = PipelineAvailablePluginsActions;
    this.myAlertOnValium = myAlertOnValium;
    this.NonStorePipelineErrorFactory = NonStorePipelineErrorFactory;
  }

  _checkVersionIsInRange(range, version) {
    if (!range || !version) { return false; }

    if (['[', '('].indexOf(range[0]) !== -1) {
      const supportedVersion = new window.CaskCommon.Version(version);
      const versionRange = new window.CaskCommon.VersionRange(range);

      return versionRange.versionIsInRange(supportedVersion);
    }

    // Check equality if range is just a single version
    return range === version;
  }

  checkPipelineArtifactVersion(config) {
    if (!config || !config.artifact) { return false; }

    let cdapVersion = this.$rootScope.cdapVersion;

    return this._checkVersionIsInRange(config.artifact.version, cdapVersion);
  }

  _fetchPostRunActions() {
    let params = {
      namespace: this.$state.params.namespace,
      pipelineType: 'cdap-data-pipeline',
      version: this.$rootScope.cdapVersion,
      extensionType: 'postaction'
    };

    return this.myPipelineApi.fetchPlugins(params);
  }

  /**
   * Create plugin artifacts map based on left panel store.
   * The key will be '<plugin name>-<plugin type>-<artifact name>'
   * Each map will contain an array of all the artifacts and
   * also information about highest version.
   * If there exist 2 artifacts with same version, it will maintain both scopes in an array.
   **/
  _createPluginsMap(pipelineConfig) {
    let deferred = this.$q.defer();
    let activePipelineType = this.HydratorPlusPlusConfigStore.getState().artifact.name;

    if (pipelineConfig.artifact.name !== activePipelineType) {
      this.PipelineAvailablePluginsActions.fetchPluginsForUpgrade(
        {
          namespace: this.$state.params.namespace,
          pipelineType: pipelineConfig.artifact.name,
          version: this.$rootScope.cdapVersion
        }
      ).then((res) => {
        let plugins = res;
        this._formatPluginsMap(plugins, pipelineConfig, deferred);
      });
    } else {
      let plugins = this.leftPanelStore.getState().plugins.pluginTypes;
      // If this is empty that means we haven't finished fetching all the plugins yet,
      // so needs to subscribe to the store
      if (_.isEmpty(plugins)) {
        this.leftPanelStoreSub = this.leftPanelStore.subscribe(() => {
          plugins = this.leftPanelStore.getState().plugins.pluginTypes;
          if (!_.isEmpty(plugins)) {
            this.leftPanelStoreSub();
            this._formatPluginsMap(plugins, pipelineConfig, deferred);
          }
        });
      } else {
        this._formatPluginsMap(plugins, pipelineConfig, deferred);
      }

    }

    return deferred.promise;
  }

  _formatPluginsMap(plugins, pipelineConfig, promise) {
    let pluginTypes = Object.keys(plugins);

    let pluginsMap = {};

    pluginTypes.forEach((type) => {
      plugins[type].forEach((plugin) => {
        let key = `${plugin.name}-${type}-${plugin.artifact.name}`;

        let allArtifacts = plugin.allArtifacts.map((artifactInfo) => {
          return artifactInfo.artifact;
        });

        let highestVersion;
        let artifactVersionMap = {};

        allArtifacts.forEach((artifact) => {
          if (!highestVersion) {
            highestVersion = angular.copy(artifact);
          } else if (highestVersion.version === artifact.version) {
            highestVersion.scope = [highestVersion.scope, artifact.scope];
          } else {
            let prevVersion = new window.CaskCommon.Version(highestVersion.version);
            let currVersion = new window.CaskCommon.Version(artifact.version);

            if (currVersion.compareTo(prevVersion) === 1) {
              highestVersion = angular.copy(artifact);
            }
          }
        });

        let value = {
          allArtifacts,
          highestVersion,
          artifactVersionMap
        };

        pluginsMap[key] = value;
      });
    });

    if (pipelineConfig.artifact.name === 'cdap-data-pipeline') {
      this._fetchPostRunActions()
        .$promise
        .then((res) => {
          let postRunActionsMap = {};

          res.forEach((plugin) => {
            let postRunKey = `${plugin.name}-${plugin.type}-${plugin.artifact.name}`;

            postRunActionsMap[postRunKey] = {
              allArtifacts: [plugin.artifact],
              highestVersion: plugin.artifact,
              artifactVersionMap: {}
            };

            postRunActionsMap[postRunKey].artifactVersionMap[plugin.artifact.version] = plugin.artifact.scope;
          });

          pluginsMap  = Object.assign(pluginsMap, postRunActionsMap);

          promise.resolve(pluginsMap);
        });
    } else {
      promise.resolve(pluginsMap);
    }
  }

  _checkErrorStages(stages, pluginsMap) {
    let transformedStages = [];

    stages.forEach((stage) => {
      let stageKey = `${stage.plugin.name}-${stage.plugin.type}-${stage.plugin.artifact.name}`;

      let stageArtifact = stage.plugin.artifact;

      let data = {
        stageInfo: stage,
        error: null
      };

      if (!pluginsMap[stageKey]) {
        data.error = 'NOTFOUND';
      } else if (!this._checkVersionIsInRange(stageArtifact.version, pluginsMap[stageKey].highestVersion.version)) {
        data.error = 'VERSION_MISMATCH';
        data.suggestion = pluginsMap[stageKey].highestVersion;

        if (typeof data.suggestion.scope !== 'string') {
          // defaulting to USER scope when both version exists
          data.suggestion.scope = 'USER';
        }

        // This is to check whether the version of the imported pipeline exist or not
        let existingVersion = pluginsMap[stageKey].artifactVersionMap[stageArtifact.version];
        if (existingVersion && existingVersion.indexOf(stageArtifact.scope) !== -1) {
          data.error = 'CAN_UPGRADE';
        }
      } else if (pluginsMap[stageKey].highestVersion.scope.indexOf(stageArtifact.scope) < 0) {
        data.error = 'SCOPE_MISMATCH';
        data.suggestion = pluginsMap[stageKey].highestVersion;
      }

      transformedStages.push(data);
    });

    return transformedStages;
  }

  getErrorStages(pipelineConfig) {
    let configStages = pipelineConfig.config.stages;
    let configPostActions = pipelineConfig.config.postActions;

    return this._createPluginsMap(pipelineConfig)
      .then((pluginsMap) => {
        let stages = this._checkErrorStages(configStages, pluginsMap);
        let postActions = this._checkErrorStages(configPostActions, pluginsMap);

        return {
          stages,
          postActions
        };
      });
  }

  upgradePipelineArtifactVersion(pipelineConfig) {
    if (!pipelineConfig || !pipelineConfig.artifact) { return; }

    let cdapVersion = this.$rootScope.cdapVersion;

    let configClone = _.cloneDeep(pipelineConfig);

    configClone.artifact.version = cdapVersion;

    return configClone;
  }

  validateAndUpgradeConfigFile(configFile) {
    if (configFile.type !== 'application/json') {
      this.myAlertOnValium.show({
        type: 'danger',
        content: 'File should be in JSON format. Please upload a file with \'.json\' extension.'
      });
      return;
    }

    let reader = new FileReader();
    reader.readAsText(configFile, 'UTF-8');

    reader.onload =  (evt) => {
      let fileDataString = evt.target.result;
      let isNotValid = this.NonStorePipelineErrorFactory.validateImportJSON(fileDataString);

      if (isNotValid) {
        this.myAlertOnValium.show({
          type: 'danger',
          content: isNotValid
        });
        return;
      }

      this.openUpgradeModal(fileDataString);
    };
  }

  openUpgradeModal(jsonData) {
    if (typeof jsonData === 'string') {
      try {
        jsonData = JSON.parse(jsonData);
      } catch (e) {
        return;
      }
    }
    this.$uibModal.open({
      templateUrl: '/assets/features/hydrator/templates/create/pipeline-upgrade-modal.html',
      size: 'lg',
      backdrop: 'static',
      keyboard: false,
      windowTopClass: 'hydrator-modal node-config-modal upgrade-modal',
      controllerAs: 'PipelineUpgradeController',
      controller: 'PipelineUpgradeModalController',
      resolve: {
        rPipelineConfig: function () {
          return jsonData;
        }
      }
    });
  }
}

angular.module(PKG.name + '.feature.hydrator')
  .service('HydratorUpgradeService', HydratorUpgradeService);
