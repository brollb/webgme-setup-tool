// DO NOT EDIT THIS FILE
// This file is automatically generated from the webgme-setup-tool.
'use strict';

<% if (typeof seeds === "undefined") seeds = [];
if (typeof addOns === "undefined") addOns = [];
if (typeof plugins === "undefined") plugins = [];
if (typeof decorators === "undefined") decorators = [];
if (typeof visualizers === "undefined") visualizers = [];
if (typeof requirejsPaths === "undefined") requirejsPaths = null;

var dirname = function(path) {
  var pathItems = path.split('/');
  pathItems.pop();
  return pathItems.join('/');
};

var printBasePaths = function(name, paths) {
    return printConfigPaths(name+'.basePaths', paths);
};

var printConfigPaths = function(name, paths) {
  paths = _.uniq(paths);
  var text =  paths.map(function(path) {
    return 'config.'+name+'.push(\''+path+'\');'
  }).join('\n');
  return text.length ? text+'\n' : text;
}; %>
var config = require('webgme/config/config.default'),
    validateConfig = require('webgme/config/validator');

<% // FIXME: This needs to be restructured... %>
// The paths can be loaded from the webgme-setup.json
<%= printBasePaths('plugin', plugins.map(dirname)) +
    printBasePaths('addOn', addOns.map(dirname)) +
    printConfigPaths('visualization.decoratorPaths', decorators.map(dirname)) +
    printBasePaths('seedProjects', seeds) %>
<% if (addOns.length > 0) { %>config.addOn.enable = true<%}%>
// Visualizer descriptors
<% if (visualizers.length > 0) { %>config.visualization.visualizerDescriptors.push('./src/visualizers/Visualizers.json');<%}%>
// Add requirejs paths
<% if (requirejsPaths) { %>config.requirejsPaths = {
<%= requirejsPaths.map(function(obj) { 
        return '  \''+obj.name+'\': \''+obj.path+'\'';
    }).join(',\n') %>
};<% } %>

<% // mongo uri %>config.mongo.uri = 'mongodb://127.0.0.1:27017/<%= appName %>'
validateConfig(config);
module.exports = config;
