# ytpld - a horrible YouTube playlist downloader

A quick and dirty command-line downloader of YouTube videos from a given playlist url, for offline viewing.

Dumps videos to the current folder, along with an m3u playlist.

If you're looking to support your favourite content creators, please try to watch their videos online without adblock. If you can't always watch on YouTube (e.g. on the move with unreliable internet), well, then maybe this is for you.


### Installation

Requires [NodeJS](http://nodejs.org)

Command line: ```npm install -g git://github.com/alextreppass/ytpld.git```


### Usage
```
ytpld [playlistUrl] -p [num]

Options:
  playlistUrl [required] - Url to youtube playlist
  p           [optional] - Number of parallel downloads. Default is 3
```

e.g. ```ytpld https://www.youtube.com/playlist?list=PLhyKYa0YJ_5B-h_nwdtshOKv7NH8uAOUa```


### Implementation Details

This uses web scraping instead of doing it properly with the YouTube API. This means it might stop working very quickly, and is unashamedly against the YouTube T&Cs.

If you're looking for something more robust, build out the playlist retrieval with [IonicaBizau/youtube-api](https://github.com/IonicaBizau/youtube-api).

The heavy lifting is done with [fent/node-ytdl-core](https://github.com/fent/node-ytdl-core).