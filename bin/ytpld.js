#!/usr/bin/env node
var _ = require('lodash');
var async = require('async');
var cheerio = require('cheerio');
var fs = require('fs');
var parseArgs = require('minimist');
var sanitizeFileName = require("sanitize-filename");
var ytdl = require('ytdl-core');

var Promise = require('bluebird');
var request = Promise.promisifyAll(require('request'));

var Class = require('../lib/class');

var DEFAULT_CONFIG = {
  parallelDownloads: 3,
  requestOptions: {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.94 Safari/537.36'
    }
  },
  titleSelector: '.pl-header-title',
  videoLinkSelector: 'a.pl-video-title-link',
  youtubeBase: 'https://www.youtube.com'
};

var YTPLD = Class({

  constructor: function (config) {
    this.config = _.extend({}, DEFAULT_CONFIG, config);
    this.filenames = [];
    this.fileErrors = [];
    this.tasks = [];
  },

  run: function () {
    var self = this;

    self._loadPlayList()
    .then(function () {
      self._findTasks();
    })
    .then(function () {
      return self._runTasksAsync();
    })
    .then(function () {
      return self._createM3uPlaylist();
    })
    .then(function () {
      self._printStats();
    })
    .catch(function (error) {
      fatalError(error);
    });
  },

  _loadPlayList: function () {
    return request.getAsync(this._requestOptions())
    .spread(function (response, body) {
      if (response.statusCode != 200) {
        throw new Error('Got unexpected response back from youtube: ' +
          response.statusCode);
      }
      this.$ = cheerio.load(body);
    }.bind(this));
  },

  _requestOptions: function () {
    return _.extend(this.config.requestOptions, {
      url: this.config.url
    });
  },

  _findTasks: function () {
    var $ = this.$;
    var $titleLinks = $(this.config.videoLinkSelector);

    this.tasks = _.map($titleLinks, function (link, index) {
      return this._taskForTitleLink($(link), index + 1);
    }, this);

    console.log('Found', this.tasks.length, 'videos in playlist');

    if (!_.any(this.tasks)) {
      throw new Error('Could not find video links in the given playlist page')
    }
  },

  _taskForTitleLink: function ($link, index) {
    var title = this._standardiseTitle($link.text(), index);
    var url = this._standardiseUrl($link.attr('href'));

    return function (asyncFinished) {
      var readStream = ytdl(url);
      var fileName = title + '.flv';

      this.filenames.push(fileName);

      console.log('Started:', fileName, '...')
      readStream.pipe(fs.createWriteStream(fileName));

      readStream.on('error', function (error) {
        console.error('Error downloading:', fileName, error.message);
        this.fileErrors.push(fileName);
      });

      readStream.on('end', function () {
        console.log('Finished:', fileName);
        asyncFinished(null);
      });
    }.bind(this);
  },

  _standardiseTitle: function (title, index) {
    var title = sanitizeFileName(_.trim(title));
    return this._zeroPad(title, index);
  },

  // zero-pad titles to ensure asciibetical ordering of filenames
  // e.g. task length 99 = [01, 02, ... 10, ... 99]
  _zeroPad: function (title, index) {
    var indexDigits = new String(index).length;
    var taskDigits = new String(this.tasks.length).length;
    var padding = 1 + (taskDigits - indexDigits);

    return Array(padding + 1).join('0') + index + ' - ' + title;
  },

  _standardiseUrl: function (url) {
    if (_.startsWith(url, this.config.youtubeBase)) {
      return url;
    } else if (_.startsWith(url, '/')) {
      return this.config.youtubeBase + url;
    } else {
      return this.config.youtubeBase + '/' + url;
    }
  },

  _runTasksAsync: function () {
    var tasks = this.tasks;
    var limit = this.config.parallelDownloads;

    console.log('Downloading', tasks.length, 'videos', limit, 'at a time');

    return new Promise(function (resolve) {
      return async.parallelLimit(tasks, limit, function (error) {
        if (error) {
          throw new Error(error.message);
        }
        resolve();
      });
    });
  },

  _createM3uPlaylist: function () {
    return new Promise(function (resolve) {
      var successes = _.difference(this.filenames, this.fileErrors);
      if (!_.any(successes)) {
        return;
      }

      var m3uPath = this._getM3uPath();
      var outs = fs.createWriteStream(m3uPath);

      outs.on('open', function () {
        this._writeM3u(successes, outs);
        outs.end();
      }.bind(this));

      outs.on('close', function() {
        console.log('Wrote playlist:', m3uPath);
        resolve();
      });

    }.bind(this));
  },

  _getM3uPath: function () {
    var name = _.trim(this.$(this.config.titleSelector).text()) || 'playlist';
    return sanitizeFileName(name + '.m3u');
  },

  _writeM3u: function (files, outs) {
    outs.write('#EXTM3U\n');
    _.each(files, function (fileName) {
      outs.write('#EXTINF:-1,' + fileName + '\n');
      outs.write('./' + fileName + '\n');
    });
  },

  _printStats: function () {
    var fileErrors = this.fileErrors;

    if (_.any(fileErrors)) {
      console.log('The following files failed to download: \n',
        fileErrors.join('\n')
      );
      process.exit(1);
    } else {
      console.log('All downloads complete');
      process.exit(0);
    }
  }

});

var fatalError = function (error) {
  console.error('Error:', error.message);
  process.exit(1);
};

var configFromArgv = function () {
  var argv = parseArgs(process.argv.slice(2));
  var anonArgs = argv._;

  if (!_.any(anonArgs)) {
    printUsage();
    process.exit(1);
  }

  var config = {
    url: anonArgs[0]
  };

  if (typeof argv.p === 'number') {
    config.parallelDownloads = argv.p
  }

  return config;
};

var printUsage = function () {
  console.log([
    '',
    'Usage: ytpl-downloader playlistUrl -p [num]',
    '',
    'Options: ',
    '\t  playlistUrl [required] - Url to youtube playlist',
    '\t  p           [optional] - Number of parallel downloads. Default is 3',
    ''
  ].join('\n'));
};

var main = function () {
  new YTPLD(configFromArgv()).run();
};

exports.YTPLD = YTPLD;

if (require.main === module) {
  main();
}