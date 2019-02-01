/**
 * Original Work Copyright 2014 IBM Corp.
 * node-red
 *
 * Copyright (c) 2016,2017,2018 Klaus Landsdorf (http://bianco-royal.de/)
 * All rights reserved.
 * node-red-contrib-modbus - The BSD 3-Clause License
 *
 **/

'use strict'

var nodeUnderTest = require('../../src/modbus-flex-connector.js')
var serverNode = require('../../src/modbus-server.js')
var nodeClient = require('../../src/modbus-client.js')

var helper = require('node-red-node-test-helper')
helper.init(require.resolve('node-red'))

describe('Flex Connector node Testing', function () {
  before(function (done) {
    helper.startServer(function () {
      done()
    })
  })

  afterEach(function (done) {
    helper.unload().then(function () {
      done()
    }).catch(function () {
      done()
    })
  })

  after(function (done) {
    helper.stopServer(function () {
      done()
    })
  })

  describe('Node', function () {
    it('should be loaded', function (done) {
      helper.load([nodeUnderTest, nodeClient], [
        {
          'id': '40ddaabb.fd44d4',
          'type': 'modbus-flex-connector',
          'name': 'FlexConnector',
          'maxReconnectsPerMinute': 4,
          'emptyQueue': true,
          'showStatusActivities': false,
          'showErrors': false,
          'server': '2a253153.fae3ce',
          'wires': []
        },
        {
          'id': '2a253153.fae3ce',
          'type': 'modbus-client',
          'name': '',
          'clienttype': 'tcp',
          'bufferCommands': true,
          'stateLogEnabled': false,
          'tcpHost': '127.0.0.1',
          'tcpPort': '11522',
          'tcpType': 'DEFAULT',
          'serialPort': '/dev/ttyUSB',
          'serialType': 'RTU-BUFFERD',
          'serialBaudrate': '9600',
          'serialDatabits': '8',
          'serialStopbits': '1',
          'serialParity': 'none',
          'serialConnectionDelay': '100',
          'unit_id': '1',
          'commandDelay': '100',
          'clientTimeout': '100',
          'reconnectTimeout': '200'
        }
      ], function () {
        var modbusNode = helper.getNode('40ddaabb.fd44d4')
        modbusNode.should.have.property('name', 'FlexConnector')
        modbusNode.should.have.property('emptyQueue', true)
        done()
      })
    })

    it('should change the Port of the client from 7522 to 8522', function (done) {
      helper.load([serverNode, nodeUnderTest, nodeClient], [
        {
          'id': '445454e4.968564',
          'type': 'modbus-server',
          'name': '',
          'logEnabled': true,
          'hostname': '127.0.0.1',
          'serverPort': '8522',
          'responseDelay': 100,
          'delayUnit': 'ms',
          'coilsBufferSize': 10000,
          'holdingBufferSize': 10000,
          'inputBufferSize': 10000,
          'discreteBufferSize': 10000,
          'showErrors': false,
          'wires': [
            [],
            [],
            []
          ]
        },
        {
          'id': '40ddaabb.fd44d4',
          'type': 'modbus-flex-connector',
          'name': 'FlexConnector',
          'maxReconnectsPerMinute': 4,
          'emptyQueue': true,
          'showStatusActivities': false,
          'showErrors': false,
          'server': '2a253153.fae3ce',
          'wires': []
        },
        {
          'id': '2a253153.fae3ce',
          'type': 'modbus-client',
          'name': '',
          'clienttype': 'tcp',
          'bufferCommands': true,
          'stateLogEnabled': false,
          'tcpHost': '127.0.0.1',
          'tcpPort': '7522',
          'tcpType': 'DEFAULT',
          'serialPort': '/dev/ttyUSB',
          'serialType': 'RTU-BUFFERD',
          'serialBaudrate': '9600',
          'serialDatabits': '8',
          'serialStopbits': '1',
          'serialParity': 'none',
          'serialConnectionDelay': '100',
          'unit_id': '1',
          'commandDelay': '100',
          'clientTimeout': '100',
          'reconnectTimeout': '200'
        }
      ], function () {
        var modbusNode = helper.getNode('40ddaabb.fd44d4')
        var clientNode = helper.getNode('2a253153.fae3ce')
        modbusNode.should.have.property('name', 'FlexConnector')
        modbusNode.should.have.property('emptyQueue', true)
        setTimeout(function () {
          modbusNode.receive({payload: {connectorType: 'TCP', tcpHost: '127.0.0.1', tcpPort: 8522}})
        }, 1000)
        setTimeout(function () {
          if (clientNode && clientNode.tcpPort === 8522) {
            done()
          }
        }, 1000)
      })
    })
  })

  describe('post', function () {
    it('should fail for invalid node', function (done) {
      helper.request().post('/modbus-flex-connector/invalid').expect(404).end(done)
    })
  })
})
