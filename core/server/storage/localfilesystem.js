// # Local File System Image Storage module
// The (default) module for storing images, using the local file system

var _       = require('lodash'),
    express = require('express'),
    fs      = require('fs-extra'),
    nodefn  = require('when/node/function'),
    path    = require('path'),
    when    = require('when'),
    errors  = require('../errorHandling'),
    config  = require('../config'),
    baseStore   = require('./base'),
    im      = require('imagemagick'),

    localFileStore;

localFileStore = _.extend(baseStore, {
    // ### Save
    // Saves the image to storage (the file system)
    // - image is the express image object
    // - returns a promise which ultimately returns the full url to the uploaded image
    'save': function (image) {
        var saved = when.defer(),
            targetDir = this.getTargetDir(config().paths.imagesPath),
            targetFilename,
            thumbnailDir;
        this.getUniqueFileName(this, image, targetDir).then(function (filename) {
            targetFilename = filename;
            thumbnailDir = path.join(targetDir, 'thumbnails');

            return nodefn.call(fs.mkdirs, targetDir);
        }).then(function () {
            return nodefn.call(fs.mkdirs, thumbnailDir);
        }).then(function() {
            return nodefn.call(fs.copy, image.path, targetFilename);
        }).then(function () {
            return nodefn.call(fs.unlink, image.path).otherwise(errors.logError);
        }).then(function () {
            // get the filename
            var fname = targetFilename.match(/[^/]*$/);
            // thumbnail
            im.resize({
                width: 480,
                height: 320,
                srcPath: targetFilename,
                dstPath: path.join(thumbnailDir, fname[0]),
                customArgs: ['-auto-orient']
            });
            im.resize({
                width: 2048,
                height: 1366,
                srcPath: targetFilename,
                dstPath: targetFilename,
                customArgs: ['-auto-orient']
            });

            // The src for the image must be in URI format, not a file system path, which in Windows uses \
            // For local file system storage can use relative path so add a slash
            var fullUrl = (config().paths.subdir + '/' + path.relative(config().paths.appRoot, targetFilename)).replace(new RegExp('\\' + path.sep, 'g'), '/');
            return saved.resolve(fullUrl);
        }).otherwise(function (e) {
            errors.logError(e);
            return saved.reject(e);
        });

        return saved.promise;
    },

    'exists': function (filename) {
        // fs.exists does not play nicely with nodefn because the callback doesn't have an error argument
        var done = when.defer();

        fs.exists(filename, function (exists) {
            done.resolve(exists);
        });

        return done.promise;
    },

    // middleware for serving the files
    'serve': function () {
        var ONE_HOUR_MS = 60 * 60 * 1000,
            ONE_YEAR_MS = 365 * 24 * ONE_HOUR_MS;

        // For some reason send divides the max age number by 1000
        return express['static'](config().paths.imagesPath, {maxAge: ONE_YEAR_MS});
    }
});

module.exports = localFileStore;
