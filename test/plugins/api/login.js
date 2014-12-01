var Lab = require('lab');
var Code = require('code');
var lab = exports.lab = Lab.script();
var config = require('../../../config');
var Hapi = require('hapi');
var AuthAttempt = require('../../../models/auth-attempt');
var Session = require('../../../models/session');
var User = require('../../../models/user');
var hapiAuthBasic = require('hapi-auth-basic');
var proxyquire = require('proxyquire');
var authPlugin = require('../../../plugins/auth');
var mailerPlugin = require('../../../plugins/mailer');
var loginPlugin = require('../../../plugins/api/login');
var bcrypt = require('bcrypt');
var stub, modelsPlugin, server, request;


lab.beforeEach(function (done) {

    stub = {
        AuthAttempt: {},
        Session: {},
        User: {}
    };

    modelsPlugin = proxyquire('../../../plugins/models', {
        '../models/auth-attempt': stub.AuthAttempt,
        '../models/session': stub.Session,
        '../models/user': stub.User
    });

    var plugins = [ hapiAuthBasic, modelsPlugin, authPlugin, mailerPlugin, loginPlugin ];
    server = new Hapi.Server();
    server.connection({ port: config.get('/port/web') });
    server.register(plugins, function (err) {

        if (err) {
            return done(err);
        }

        done();
    });
});


lab.afterEach(function (done) {

    server.plugins.models.BaseModel.disconnect();

    done();
});


lab.experiment('Login Plugin (Create Session)', function () {

    lab.beforeEach(function (done) {

        request = {
            method: 'POST',
            url: '/login',
            payload: {
                username: 'ren',
                password: 'baddog'
            }
        };

        done();
    });


    lab.test('it returns an error when detecting abuse fails', function (done) {

        stub.AuthAttempt.abuseDetected = function (ip, username, callback) {

            callback(Error('abuse detection failed'));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            done();
        });
    });


    lab.test('it returns early when abuse is detected', function (done) {

        stub.AuthAttempt.abuseDetected = function (ip, username, callback) {

            callback(null, true);
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(400);
            Code.expect(response.result.message).to.match(/maximum number of auth attempts reached/i);

            done();
        });
    });


    lab.test('it returns an error when find by credentials fails', function (done) {

        stub.AuthAttempt.abuseDetected = function (ip, username, callback) {

            callback(null, false);
        };

        stub.User.findByCredentials = function (username, password, callback) {

            callback(Error('find by credentials failed'));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            done();
        });
    });


    lab.test('it returns an error when creating a new auth attempt fails', function (done) {

        stub.AuthAttempt.abuseDetected = function (ip, username, callback) {

            callback(null, false);
        };

        stub.AuthAttempt.create = function (ip, username, callback) {

            callback(Error('create auth attempt failed'));
        };

        stub.User.findByCredentials = function (username, password, callback) {

            callback();
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            done();
        });
    });


    lab.test('it returns early after creating a new auth attempt', function (done) {

        stub.AuthAttempt.abuseDetected = function (ip, username, callback) {

            callback(null, false);
        };

        stub.AuthAttempt.create = function (ip, username, callback) {

            callback(null, new AuthAttempt({}));
        };

        stub.User.findByCredentials = function (username, password, callback) {

            callback();
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(400);
            Code.expect(response.result.message).to.match(/username and password combination not found/i);

            done();
        });
    });


    lab.test('it returns an error when creating a new session fails', function (done) {

        stub.AuthAttempt.abuseDetected = function (ip, username, callback) {

            callback(null, false);
        };

        stub.AuthAttempt.create = function (ip, username, callback) {

            callback(null, new AuthAttempt({}));
        };

        stub.User.findByCredentials = function (username, password, callback) {

            callback(null, new User({ username: 'ren' }));
        };

        stub.Session.create = function (username, callback) {

            callback(Error('create session failed'));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            done();
        });
    });


    lab.test('it returns a session successfully', function (done) {

        stub.AuthAttempt.abuseDetected = function (ip, username, callback) {

            callback(null, false);
        };

        stub.AuthAttempt.create = function (ip, username, callback) {

            callback(null, new AuthAttempt({}));
        };

        stub.User.findByCredentials = function (username, password, callback) {

            callback(null, new User({ username: 'ren' }));
        };

        stub.Session.create = function (username, callback) {

            callback(null, new Session({ username: username }));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(200);
            Code.expect(response.result).to.be.an.object();

            done();
        });
    });
});


lab.experiment('Login Plugin Forgot Password', function () {

    lab.beforeEach(function (done) {

        request = {
            method: 'POST',
            url: '/login/forgot',
            payload: {
                email: 'ren@stimpy.show'
            }
        };

        done();
    });


    lab.test('it returns an error when find one fails', function (done) {

        stub.User.findOne = function (conditions, callback) {

            callback(Error('find one failed'));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            done();
        });
    });


    lab.test('it returns early when find one misses', function (done) {

        stub.User.findOne = function (conditions, callback) {

            callback();
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(200);

            done();
        });
    });


    lab.test('it returns an error if any critical step fails', function (done) {

        stub.User.findOne = function (conditions, callback) {

            var user = {
                _id: 'BL4M0'
            };

            callback(null, user);
        };

        stub.User.findByIdAndUpdate = function (id, update, callback) {

            callback(Error('update failed'));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            done();
        });
    });


    lab.test('it succussfully sends a reset password request', function (done) {

        stub.User.findOne = function (conditions, callback) {

            var user = {
                _id: 'BL4M0'
            };

            callback(null, user);
        };

        stub.User.findByIdAndUpdate = function (id, update, callback) {

            callback(null, {});
        };

        var realSendEmail = server.plugins.mailer.sendEmail;
        server.plugins.mailer.sendEmail = function (options, template, context, callback) {

            callback(null, {});
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(200);

            server.plugins.mailer.sendEmail = realSendEmail;

            done();
        });
    });
});


lab.experiment('Login Plugin Reset Password', function () {

    lab.beforeEach(function (done) {

        request = {
            method: 'POST',
            url: '/login/reset',
            payload: {
                key: 'abcdefgh-ijkl-mnop-qrst-uvwxyz123456',
                email: 'ren@stimpy.show',
                password: 'letmein'
            }
        };

        done();
    });


    lab.test('it returns an error when find one fails', function (done) {

        stub.User.findOne = function (conditions, callback) {

            callback(Error('find one failed'));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            done();
        });
    });


    lab.test('it returns a bad request when find one misses', function (done) {

        stub.User.findOne = function (conditions, callback) {

            callback();
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(400);

            done();
        });
    });


    lab.test('it returns an error if any critical step fails', function (done) {

        stub.User.findOne = function (conditions, callback) {

            var user = {
                _id: 'BL4M0',
                resetPassword: {
                    token: 'O0HL4L4'
                }
            };

            callback(null, user);
        };

        var realBcryptCompare = bcrypt.compare;
        bcrypt.compare = function (key, token, callback) {

            callback(Error('compare failed'));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            bcrypt.compare = realBcryptCompare;

            done();
        });
    });


    lab.test('it returns a bad request if the key does not match', function (done) {

        stub.User.findOne = function (conditions, callback) {

            var user = {
                _id: 'BL4M0',
                resetPassword: {
                    token: 'O0HL4L4'
                }
            };

            callback(null, user);
        };

        var realBcryptCompare = bcrypt.compare;
        bcrypt.compare = function (key, token, callback) {

            callback(null, false);
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(400);

            bcrypt.compare = realBcryptCompare;

            done();
        });
    });


    lab.test('it succussfully sets a password', function (done) {

        stub.User.findOne = function (conditions, callback) {

            var user = {
                _id: 'BL4M0',
                resetPassword: {
                    token: 'O0HL4L4'
                }
            };

            callback(null, user);
        };

        var realBcryptCompare = bcrypt.compare;
        bcrypt.compare = function (key, token, callback) {

            callback(null, true);
        };

        stub.User.findByIdAndUpdate = function (id, update, callback) {

            callback(null, {});
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(200);

            bcrypt.compare = realBcryptCompare;

            done();
        });
    });
});
