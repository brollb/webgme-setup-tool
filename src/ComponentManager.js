/*globals define*/
/*
 * This is the basic structure for component managers
 *
 * In the component manager, all public functions (functions not preceded by a _)
 * are assumed to be actions accepted from the command line.
 *
 * Note: "init" is a reserved action and cannot be used by the ComponentManager
 */

'use strict';

var utils = require('./utils'),
    rm_rf = require('rimraf'),
    plural = require('plural'),
    fs = require('fs'),
    path = require('path'),
    childProcess = require('child_process'),
    spawn = childProcess.spawn,
    Logger = require(__dirname + '/Logger');

var ComponentManager = function(name, logger) {
    this._logger = logger || new Logger();
    this._name = name;  // Name to be used in cli usage, etc
    this._group = plural(name);  // Plural version of name
    this._webgmeName = name;  // Name to be used only in webgme config
    this._prepareWebGmeConfig();

    var next;
    for (var action in this) {
        if (action[0] !== '_') {
            next = this[action].bind(this);
            this[action] = this._preprocess.bind(this, next);
        }
    }
};

ComponentManager.prototype._preprocess = function(next, args, callback) {
    // Check for project directory
    if (utils.getRootPath() === null) {
        var err = 'Could not find a project in current or any parent directories';
        this._logger.error(err);
        return callback(err);
    }
    next(args, callback);
};

/**
 * List the currently recognized components.
 *
 * @param args
 * @param callback
 * @return {undefined}
 */
ComponentManager.prototype.ls = function(args, callback) {
    var config = utils.getConfig(),
        plugins = Object.keys(config.components[this._group]).join(' ') || '<none>',
        deps = Object.keys(config.dependencies[this._group]).join(' ') || '<none>';

    this._logger.write('Detected '+this._group+': '+plugins+
        '\nThird party '+this._group+': '+deps);
    callback(null);
};

ComponentManager.prototype.rm = function(args, callback) {
    var name = args.name,
        config = utils.getConfig(),
        type = config.components[this._group][name] !== undefined ? 
            'components' : 'dependencies';

    // Remove from config files
    this._removeFromConfig(name, type);

    // Remove any actual files
    if (type === 'components') {
        // Remove the name directories from src, test
        var paths = Object.keys(config[type][this._group][name]),
            remaining = paths.length,
            finished = function() {
                if (--remaining === 0) {
                    return callback();
                }
            };
        paths.forEach(function(pathType) {
            var componentPath = config[type][this._group][name][pathType];
            this._logger.info('Removing '+componentPath);
            rm_rf(componentPath, finished);
        }, this);
    } else {
        callback();
    }
};

// TODO: Refactor this
ComponentManager.prototype.add = function(args, callback) {
    var project,
        componentName,
        pkgPath,
        pkgContent,
        projectRoot = utils.getRootPath(),
        pkg,
        job;

    if (!(args.name && args.project)) {
    // FIXME: This shouldn't log to commandline
        return this._logger.error(
        'Usage: webgme add '+this._name+' ['+this._name+'] [project]');
    }
    componentName = args.name;
    project = args.project;
    // Add the project to the package.json
    var pkgProject = utils.getPackageName(project);
    this._logger.info(
        'Adding '+componentName+' from '+pkgProject);

    // Add the component to the webgme config component paths
    // FIXME: Call this without --save then later save it
    job = spawn('npm', ['install', project, '--save'],
        {cwd: projectRoot}); 

    this._logger.info('npm install '+project+' --save');
    this._logger.infoStream(job.stdout);
    this._logger.infoStream(job.stderr);

    job.on('close', function(code) {
        this._logger.info('npm exited with: '+code);
        if (code === 0) {  // Success!
            // Look up the componentPath by trying to load the config of 
            // the new project or find the component through the component 
            // paths defined in the config.js
            var otherConfig,
                componentPath = null,
                config = utils.getConfig(),
                gmeCliConfigPath = utils.getConfigPath(pkgProject.toLowerCase()),
                gmeConfigPath = utils.getGMEConfigPath(pkgProject.toLowerCase()),
                dependencyRoot = path.dirname(gmeConfigPath);

            if (fs.existsSync(gmeCliConfigPath)) {
                otherConfig = JSON.parse(fs.readFileSync(gmeCliConfigPath, 'utf-8'));
                if (otherConfig.components[this._group][componentName]) {
                    componentPath = otherConfig.components[this._group][componentName].src;
                }
            } else if (fs.existsSync(gmeConfigPath)) {
                otherConfig = require(gmeConfigPath);
                componentPath = utils.getPathContaining(otherConfig[this._webgmeName].basePaths.map(
                function(p) {
                    if (!path.isAbsolute(p)) {
                        return path.join(path.dirname(gmeConfigPath), p);
                    }
                    return p;
                }
                ), componentName);
                componentPath = componentPath !== null ? 
                    path.join(componentPath,componentName) : null;
            } else {
                var err = 'Did not recognize the project as a WebGME project';
                this._logger.error(err);
                return callback(err);
            }

            // Verify that the component exists in the project
            if (!componentPath) {
                this._logger.error(pkgProject+' does not contain '+componentName);
                return callback(pkgProject+' does not contain '+componentName);
            }
            if (!path.isAbsolute(componentPath)) {
                componentPath = path.join(dependencyRoot, componentPath);
            }
            // If componentPath is not a directory, take the containing directory
            if (!fs.lstatSync(componentPath).isDirectory()) {
                componentPath = path.dirname(componentPath);
            }

            componentPath = path.relative(projectRoot, componentPath);

            config.dependencies[this._group][componentName] = {
                project: pkgProject,
                path: componentPath
            };
            utils.saveConfig(config);

            // Update the webgme config file from 
            // the cli's config
            utils.updateWebGMEConfig();
            callback();

        } else {
            var err = 'Could not find project!';
            this._logger.error(err);
            return callback(err);
        }
    }.bind(this));
};

ComponentManager.prototype._removeFromConfig = function(plugin, type) {
    var config = utils.getConfig();
    // Remove entry from the config
    delete config[type][this._group][plugin];
    utils.saveConfig(config);
    utils.updateWebGMEConfig();

    this._logger.write('Removed the '+plugin+'!');
};

ComponentManager.prototype._getSaveLocation = function(type) {
    // Guarantee that it is either 'src' or 'test'
    type = type === 'test' ? 'test': 'src';
    var savePath = path.join(utils.getRootPath(), type, this._group);
    // We assume this means the location is relevant and will create
    // it if needed
    utils.mkdir(savePath);
    return savePath;
};

/**
 * Add the names for components and dependencies
 * for this given component type
 *
 * @return {undefined}
 */
ComponentManager.prototype._prepareWebGmeConfig = function() {
    // Check for project directory
    var projectHome = utils.getRootPath();
    if (projectHome !== null) {
        // Check for plugins entry in .webgme
        var config = utils.getConfig();
        var entries = Object.keys(config);
        entries.forEach(function(entry) {
            if (config[entry][this._group] === undefined) {
                config[entry][this._group] = {};
            }
        }, this);
        utils.saveConfig(config);
    }
};

/**
 * Register the given component in the webgme-setup-tool config
 *
 * @param {String} name
 * @param {Object} content
 * @return {undefined}
 */
ComponentManager.prototype._register = function(name, content) {
    var config = utils.getConfig();
    config.components[this._group][name] = content;
    utils.saveConfig(config);
    utils.updateWebGMEConfig();
};

module.exports = ComponentManager;