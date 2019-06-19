import { WithStyles } from '@material-ui/core/styles/withStyles';
import { ConnectionType } from 'components/DataPrepConnections/ConnectionType';

interface IArtifact {
  name: string;
  version: string;
  scope: string;
}

interface IPluginProperties {
  [key: string]: string;
}

interface IPlugin {
  label: string;
  artifact: IArtifact;
  properties: IPluginProperties;
}

interface IPluginNode {
  name: string;
  plugin: IPlugin;
  type: string;
}

interface IWidgetAttributes {
  connectionType: ConnectionType;
}

interface IPluginFunctionConfig {
  widget: string;
  label: string;
  'widget-attributes': IWidgetAttributes;
}

export {
  IArtifact,
  IPluginProperties,
  IPlugin,
  IPluginNode,
  IWidgetAttributes,
  IPluginFunctionConfig,
};
