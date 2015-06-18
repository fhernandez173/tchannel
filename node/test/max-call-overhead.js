// Copyright (c) 2015 Uber Technologies, Inc.
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

'use strict';

var allocCluster = require('./lib/alloc-cluster.js');

allocCluster.test('request() with large header key', {
    numPeers: 2
}, function t(cluster, assert) {
    cluster.logger.whitelist('info', 'resetting connection');

    var one = remoteService(cluster.channels[0]);
    var two = cluster.channels[1];

    var subTwo = two.makeSubChannel({
        serviceName: 'server'
    });

    subTwo.waitForIdentified({
        host: one.hostPort
    }, function onIdentified(err) {
        assert.ifError(err);

        subTwo.request({
            serviceName: 'server',
            hasNoParent: true,
            headers: {
                'as': 'raw',
                'cn': 'wat',
                'someReallyLargeHeaderKey': 'a'
            }
        }).send('echo', 'a', 'b', onResponse);
    });

    function onResponse(err, resp, arg2, arg3) {
        assert.ok(err);
        assert.ok(err.isErrorFrame);
        assert.equal(err.codeName, 'ProtocolError');
        assert.equal(err.message,
            'tchannel read failure: The header: someReallyLargeHeaderKey exceeds 16 bytes'
        );

        assert.equal(null, resp);

        assert.equal(cluster.logger.items().length, 1);
        var logLine = cluster.logger.items()[0];
        assert.equal(logLine.levelName, 'info');
        assert.equal(logLine.meta.error.type, 'tchannel.protocol.read-failed');

        assert.end();
    }
});

function remoteService(chan) {
    chan.makeSubChannel({
        serviceName: 'server'
    }).register('echo', function echo(req, res, arg2, arg3) {
        res.headers.as = 'raw';
        res.sendOk(arg2, arg3);
    });

    return chan;
}
