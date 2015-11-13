/*globals describe,it,before,after*/
var BaseManager = require('../lib/BaseManager'),
    Logger = require('../lib/Logger'),
    fs = require('fs'),
    path = require('path'),
    assert = require('assert'),
    _ = require('lodash'),
    rm_rf = require('rimraf'),
    utils = require(__dirname+'/res/utils'),
    nop = function(){};

var logger = new Logger(),
    emitter = logger._emitter,
    manager = new BaseManager(logger);

var WebGMEConfig = 'config.webgme.js',
    SETUP_CONFIG = 'webgme-setup.json';

var PROJECT_DIR,
    TMP_DIR = path.join(__dirname, '..', 'test-tmp'),
    TMP_PROJECT_DIR;

describe('BaseManager', function() {
    'use strict';

    before(function(done) {
        if (!fs.existsSync(TMP_DIR)) {
            fs.mkdir(TMP_DIR, function() {
                process.chdir(TMP_DIR);
                done();
            });
        } else {
            rm_rf(TMP_DIR, function() {
                fs.mkdir(TMP_DIR, function() {
                    process.chdir(TMP_DIR);
                    done();
                });
            });
        }
    });

    // Creating a new item from boilerplate
    describe('basic commands', function() {
        PROJECT_DIR = path.join(TMP_DIR, 'BaseManagerInitProject');
        before(function(done) {
            utils.getCleanProject(PROJECT_DIR, done);
        });

        describe('init', function() {
            var appName = 'Init.Project',
                initProject = path.join(TMP_DIR, appName);

            before(function(done) {
                process.chdir(TMP_DIR);
                manager.init({name: initProject}, function() {
                    process.chdir(initProject);
                    done();
                });
            });

            it('should create a new directory with project name', function() {
                assert(fs.existsSync(initProject));
            });

            it('should use the project name in the mongodb uri', function() {
                var configPath = path.join(initProject, 'config', 'config.webgme.js'),
                    config = require(configPath);
                assert.equal(appName.toLowerCase().replace(/\./g, '_'), config.mongo.uri.split('/').pop());
            });

            it('should create (valid) globals test fixture', function() {
                var fixturePath = path.join(initProject, 'test', 'globals.js');
                assert(fs.existsSync(fixturePath));
            });

            it('should create a src and test dirs', function() {
                var res = ['src', 'test']
                    .map(function(dir) {
                        return path.join(initProject, dir);
                    })
                    .map(fs.existsSync)
                    .forEach(assert);
            });

            it('should create a webgme-setup.json file in project root', function() {
                assert(fs.existsSync(path.join(initProject, 'webgme-setup.json')));
            });

            it('should initialize an npm project', function() {
                var packageJSON = path.join(initProject, 'package.json');
                assert(fs.existsSync(packageJSON));
            });

            it('should name the npm project appropriately', function() {
                var packageJSON = path.join(initProject, 'package.json');
                var pkg = require(packageJSON);
                assert.equal(pkg.name, 'Init.Project'.toLowerCase());
            });

            it('should add the webgme as a dependency', function() {
                var packageJSON = path.join(initProject, 'package.json'),
                    deps = require(packageJSON).dependencies;

                assert(deps.hasOwnProperty('webgme'));
            });

            // issue 51
            it('should use the same version of webgme as the setup tool', function() {
                // Compare the package.json values
                var packageJSON = path.join(initProject, 'package.json'),
                    toolJson = path.join(__dirname, '..', 'package.json'),
                    toolDeps = require(toolJson).dependencies,
                    deps = require(packageJSON).dependencies;

                assert.equal(deps.webgme, toolDeps.webgme);
            });

            it('should create webgme app.js file', function() {
                var app = path.join(initProject, 'app.js');
                assert(fs.existsSync(app));
            });

            // issue 15
            it('should pretty printed webgme-setup.json', function() {
                var config = path.join(initProject, 'webgme-setup.json'),
                    content = fs.readFileSync(config, 'utf8');
                // Check that it is printed on multiple lines
                assert(content.split('\n').length > 3);
            });

            // WebGME config
            describe('WebGME config', function() {
                var CONFIG_DIR = path.join(initProject, 'config');

                it('should create config directory', function() {
                    assert(fs.existsSync(CONFIG_DIR));
                });

                it('should create a webgme config file', function() {
                    var config = path.join(CONFIG_DIR, WebGMEConfig);
                    assert(fs.existsSync(config));
                });

                it('should create editable (boilerplate) webgme config file', function() {
                    var config = path.join(CONFIG_DIR, 'config.default.js');
                    assert(fs.existsSync(config));
                });
            });

            it('should fail f the dir exists', function() {
                manager.init({name: initProject}, function(err) {
                    assert(!!err);
                });
            });
        });

        describe('init w/o args', function() {
            
            it('should create webgme project in current directory', function(done) {
                TMP_PROJECT_DIR = path.join(TMP_DIR, 'InitNoArgs');
                fs.mkdirSync(TMP_PROJECT_DIR);
                process.chdir(TMP_PROJECT_DIR);
                manager.init({}, function() {
                    var configPath = path.join(TMP_PROJECT_DIR, SETUP_CONFIG);
                    assert(fs.existsSync(configPath));
                    done();
                });
            });

            it('should fail if dir has webgme-setup.json', function(done) {
                TMP_PROJECT_DIR = path.join(TMP_DIR, 'InitNoArgsFail');
                fs.mkdirSync(TMP_PROJECT_DIR);
                process.chdir(TMP_PROJECT_DIR);
                fs.writeFileSync(path.join(TMP_PROJECT_DIR, SETUP_CONFIG), 'stuff');
                manager.init({}, function(err) {
                    var appPath = path.join(TMP_PROJECT_DIR, 'app.js');
                    assert(!fs.existsSync(appPath));
                    assert(!!err);
                    done();
                });
            });

            it('should succeed in existing project', function(done) {
                TMP_PROJECT_DIR = path.join(TMP_DIR, 'InitNoArgsSucceed');
                fs.mkdirSync(TMP_PROJECT_DIR);
                process.chdir(TMP_PROJECT_DIR);
                fs.writeFileSync(path.join(TMP_PROJECT_DIR, 'temp'), 'stuff');
                manager.init({}, function(err) {
                    var configPath = path.join(TMP_PROJECT_DIR, SETUP_CONFIG);
                    assert(fs.existsSync(configPath));
                    assert(!err);
                    done();
                });
            });

        });

        describe('merging package.json', function() {
            var pkgJsonPath,
                oldPkgJson = {
                    merged: true,
                    devDependencies: {
                        lodash: '1.1.1'
                    },
                    dependencies: {
                        lodash: '1.1.1'
                    }
                };

            before(function(done) {
                TMP_PROJECT_DIR = path.join(TMP_DIR, 'MergePackageJson');
                pkgJsonPath = path.join(TMP_PROJECT_DIR, 'package.json');

                fs.mkdirSync(TMP_PROJECT_DIR);
                process.chdir(TMP_PROJECT_DIR);
                fs.writeFileSync(pkgJsonPath,
                    JSON.stringify(oldPkgJson));

                manager.init({}, done);
            });

            it('should merge package.json', function() {
                var pkgJson = require(pkgJsonPath);
                assert(pkgJson.merged);
            });

            it('should preserve dependencies', function() {
                var pkgJson = require(pkgJsonPath);
                assert(pkgJson.dependencies.lodash, 'Overwrote the dependencies');
            });

            it('should preserve devDependencies', function() {
                var pkgJson = require(pkgJsonPath);
                assert(pkgJson.devDependencies.lodash, 'Overwrote the devDependencies');
            });
        });

        after(function(done) {
            if (fs.existsSync(PROJECT_DIR)) {
                rm_rf(PROJECT_DIR, done);
            } else {
                done();
            }
        });
    });
});