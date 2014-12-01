var Lab = require('lab');
var Code = require('code');
var lab = exports.lab = Lab.script();
var config = require('../../../config');
var Hapi = require('hapi');
var mailerPlugin = require('../../../plugins/mailer');
var contactPlugin = require('../../../plugins/api/contact');
var server, request;


lab.beforeEach(function (done) {

    var plugins = [ mailerPlugin, contactPlugin ];
    server = new Hapi.Server();
    server.connection({ port: config.get('/port/web') });
    server.register(plugins, function (err) {

        if (err) {
            return done(err);
        }

        done();
    });
});


lab.experiment('Contact Plugin', function () {

    lab.beforeEach(function (done) {

        request = {
            method: 'POST',
            url: '/contact',
            payload: {
                name: 'Toast Man',
                email: 'mr@toast.show',
                message: 'I love you man.'
            }
        };

        done();
    });


    lab.test('it returns an error when send email fails', function (done) {

        var realSendEmail = server.plugins.mailer.sendEmail;
        server.plugins.mailer.sendEmail = function (options, template, context, callback) {

            callback(Error('send email failed'));
        };

        server.inject(request, function (response) {

            Code.expect(response.statusCode).to.equal(500);

            server.plugins.mailer.sendEmail = realSendEmail;

            done();
        });
    });


    lab.test('it returns success after sending an email', function (done) {

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
