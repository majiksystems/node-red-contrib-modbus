/**

 The BSD 3-Clause License

 Copyright (c) 2016, Klaus Landsdorf (http://bianco-royal.de/)
 All rights reserved.
 node-red-contrib-modbus

 Redistribution and use in source and binary forms, with or without modification,
 are permitted provided that the following conditions are met:

 1. Redistributions of source code must retain the above copyright notice,
 this list of conditions and the following disclaimer.

 2. Redistributions in binary form must reproduce the above copyright notice,
 this list of conditions and the following disclaimer in the documentation and/or
 other materials provided with the distribution.

 3. Neither the name of the copyright holder nor the names of its contributors may be
 used to endorse or promote products derived from this software without specific prior written permission.

 THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
 INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS
 FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR
 CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY,
 WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

 @author <a href="mailto:klaus.landsdorf@bianco-royal.de">Klaus Landsdorf</a> (Bianco Royal)

 **/

module.exports = function (RED) {
    "use strict";
    var Stampit = require('stampit');
    var util = require('util');
    var modbus = require('node-modbus');
    var mbBasics = require('./modbus-basics');

    function ModbusServer(config) {

        RED.nodes.createNode(this, config);

        this.name = config.name;
        this.logEnabled = config.logEnabled;
        this.serverPort = config.serverPort;
        this.responseDelay = config.responseDelay;
        this.delayUnit = config.delayUnit;

        this.coilsBufferSize = config.coilsBufferSize;
        this.holdingBufferSize = config.holdingBufferSize;
        this.inputBufferSize = config.inputBufferSize;

        var node = this;

        node.server = null;

        set_node_status_to("initialized");

        function verbose_warn(logMessage) {
            if (RED.settings.verbose) {
                node.warn((node.name) ? node.name + ': ' + logMessage : 'Modbus response: ' + logMessage);
            }
        }

        function verbose_log(logMessage) {
            if (RED.settings.verbose) {
                node.log(logMessage);
            }
        }

        function set_node_status_to(statusValue) {
            return;
            if (mbBasics.statusLog) {
                verbose_log("server status: " + statusValue);
            }

            var fillValue = "red";
            var shapeValue = "dot";

            switch (statusValue) {

                case "initialized":
                    fillValue = "green";
                    shapeValue = "ring";
                    break;

                case "active":
                    fillValue = "green";
                    shapeValue = "dot";
                    break;

                default:
                    if (!statusValue || statusValue == "waiting") {
                        fillValue = "blue";
                        statusValue = "waiting ...";
                    }
                    break;
            }

            node.status({fill: fillValue, shape: shapeValue, text: statusValue});
        }

        var ModbusServer = new Stampit({
            'logEnabled': node.logEnabled,
            'port': node.serverPort,
            'responseDelay': node.responseDelay,
            'coils': new Buffer(node.coilsBufferSize),
            'holding': new Buffer(node.holdingBufferSize),
            'input': new Buffer(node.inputBufferSize)
        }).refs({'logEnabled': true, 'port': 10502, 'responseDelay': 100})
            .compose(modbus.server.tcp.complete)
            .init(function () {

                var init = function () {

                    this.getCoils().writeUInt8(0);

                    this.on('readCoilsRequest', function (start, quantity) {

                        var oldValue = this.getCoils().readUInt8(start);
                        oldValue = (oldValue + 1) % 255;
                        this.getCoils().writeUInt8(oldValue, start);
                    });

                    this.getHolding().writeUInt16BE(1, 0);
                    this.getHolding().writeUInt16BE(2, 2);
                    this.getHolding().writeUInt16BE(3, 4);
                    this.getHolding().writeUInt16BE(4, 6);
                    this.getHolding().writeUInt16BE(5, 8);
                    this.getHolding().writeUInt16BE(6, 10);
                    this.getHolding().writeUInt16BE(7, 12);
                    this.getHolding().writeUInt16BE(8, 14);

                }.bind(this);

                init();
            });

        verbose_log("starting modbus server");

        try {
            node.server = ModbusServer();
        } catch (err) {
            verbose_warn(err);
            set_node_status_to("error");
        }

        if (node.server != null) {
            verbose_log("modbus server started");
            set_node_status_to("active");
        }
        else {
            verbose_warn("modbus server isn't ready");
            set_node_status_to("error");
        }

        node.on("input", function (msg) {

            verbose_log('Input:' + msg);

            node.send(build_message(msg, node.server.getHolding(), node.server.getCoils(), node.server.getInput()));
        });

        function build_message(msg, modbusHolding, modbusCoils, modbusInput) {
            return [
                {type: 'holding', message: msg, payload: modbusHolding},
                {type: 'coils', message: msg, payload: modbusCoils},
                {type: 'input', message: msg, payload: modbusInput}
            ]
        }

        node.on("close", function () {
            verbose_warn("server close");
            node.server.close();
            node.server = null;
            set_node_status_to("closed");
        });
    }

    RED.nodes.registerType("modbus-server", ModbusServer);
};
