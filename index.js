var _ = require('lodash');
var async = require('async');
var fs = require('fs');
var cheerio = require('cheerio');
var minimist = require('minimist');
var request = require('request');
var ytdl = require('ytdl-core');

var DEFAULT_CONFIG = {
  parallelLimit: 3
};
var DEFAULT_REQUEST_OPTIONS = {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_5) ' +
    'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/40.0.2214.94 Safari/537.36'
  }
};
var YOUTUBE_BASE = 'https://www.youtube.com';
var TITLE_SELECTOR = 'a.pl-video-title-link';

var loadPlayList = function (config) {
  var requestOptions = _.extend({ url: config.url }, DEFAULT_REQUEST_OPTIONS);

  request(requestOptions, function (error, response, body) {
    if (!error && response.statusCode == 200) {
      var tasks = getTasks(cheerio.load(body));
      console.log('Found ' + tasks.length + ' videos in playlist');
      downloadVideosInParallel(tasks, config);
    }
  });
};

var getTasks = function ($) {
  return _.map($(TITLE_SELECTOR), function (titleLink) {
    var $link = $(titleLink);
    var title = standardiseTitle($link.text());
    var url = standardiseUrl($link.attr('href'));

    return downloadTask(url, title);
  });
};

var standardiseTitle = function (title) {
  return _.snakeCase(_.trim(title));
};

var standardiseUrl = function (url) {
  if (_.startsWith(url, YOUTUBE_BASE)) {
    return url;
  } else if (_.startsWith(url, '/')) {
    return YOUTUBE_BASE + url;
  } else {
    return YOUTUBE_BASE + '/' + url;
  }
};

var downloadTask = function (url, title) {
  return function (callback) {
    var readStream = ytdl(url);
    var fileName = title + '.flv';

    console.log('Downloading: ' + fileName + '...')
    readStream.pipe(fs.createWriteStream(fileName));

    readStream.on('error', function(err) {
      console.error(err.message);
      process.exit(1);
    });

    readStream.on('end', function () {
      console.log('Finished: ' + fileName);
      callback(null);
    });
  };
};

var downloadVideosInParallel = function (tasks, config) {
  async.parallelLimit(tasks, config.parallelLimit, function (err, results) {
    if (err) {
      console.error(err.message);
      process.exit(1);
    }
    console.log('Finished all downloads; exiting');
    process.exit(0);
  });
};

var printUsage = function () {
  console.log('Usage: ytpl-downloader playlistUrl -p [num]');
  console.log('');
  console.log('Options: ');
  console.log('\t  playlistUrl [required] url to youtube playlist');
  console.log('\t  p [optional] number of parallel downloads');
  console.log('');
};

var configFromArgv = function () {
  var argv = minimist(process.argv.slice(2));
  if (_.isEmpty(argv._)) {
    printUsage();
    process.exit(0);
  }
  return {
    url: argv._[0],
    parallelLimit: argv.p || 3
  }
}

var config = _.extend({}, DEFAULT_CONFIG, configFromArgv());
loadPlayList(config);