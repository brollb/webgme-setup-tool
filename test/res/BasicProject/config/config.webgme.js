// DO NOT EDIT THIS FILE
// This file is automatically generated from the webgme-setup-tool.
'use strict';

var config = require('webgme/config/config.default'),
    validateConfig = require('webgme/config/validator');

// The paths can be loaded from the webgme-setup.json
config.plugin.basePaths.push('src/plugins');
config.addOn.basePaths.push('src/addOns/MyAddon');
config.visualization.layout.basePaths.push('src/layouts');
config.seedProjects.basePaths.push('src/seeds/test');

config.addOn.enable = true;

config.visualization.panelPaths.push('src/visualizers/panels');

config.rest.components['routers/MyRouter'] = __dirname + '/../src/routers/MyRouter/MyRouter.js';

// Visualizer descriptors
config.visualization.visualizerDescriptors.push('./src/visualizers/Visualizers.json');
// Add requirejs paths
config.requirejsPaths = {
  'panels': './src/visualizers/panels',
  'widgets': './src/visualizers/widgets'
};

config.visualization.layout['default'] = 'EnabledLayout';
config.mongo.uri = 'mongodb://127.0.0.1:27017/basicproject';
validateConfig(config);
module.exports = config;