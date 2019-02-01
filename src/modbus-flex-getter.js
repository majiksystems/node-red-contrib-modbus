/**
 Original Work Copyright 2015 Valmet Automation Inc.

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.

 The BSD 3-Clause License

 Copyright (c) 2016, Klaus Landsdorf (http://bianco-royal.de/)
 All rights reserved.
 node-red-contrib-modbus

 merged back from
 Modified work Copyright © 2016, UChicago Argonne, LLC
 All Rights Reserved
 node-red-contrib-modbustcp (ANL-SF-16-004)
 Jason D. Harper, Argonne National Laboratory

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
    var async = require("async");
    var util = require('util');
    var mbBasics = require('./modbus-basics');

    function ModbusFlexGetter(config) {

        RED.nodes.createNode(this, config);

        this.name = config.name;
        this.connection = null;

        var node = this;
        var modbusClient = RED.nodes.getNode(config.server);
        var timerID = null;
        var retryTime = 15000; // 15 sec.
        var closeCounter = 0;
        var connectionInitDone = false;

        set_node_status_to("waiting");

        node.receiveEventCloseRead = function () {

            if (connectionInitDone) {

                closeCounter++;

                if (closeCounter > 100) {
                    set_node_status_to("blocked by downloading?");
                    closeCounter = 100;
                } else {
                    set_node_status_to("disconnected");
                }

                if (timerID) {
                    clearInterval(timerID); // clear Timer from events
                }

                timerID = setInterval(function () {
                    closeCounter = 0;
                    // auto reconnect from client
                }, retryTime);
            }
        };

        node.receiveEventConnectRead = function () {

            if (connectionInitDone) {

                closeCounter = 0;

                set_node_status_to("connected");

                if (timerID) {
                    clearInterval(timerID); // clear Timer from events
                }
            }
        };

        node.receiveEventErrorRead = function (err, pkg) {

            set_node_status_to("error");
            if (pkg) {
                verbose_log(JSON.stringify(pkg));
            }
            node.error(JSON.stringify(err));
        };

        function connectModbusSlave() {

            closeCounter = 0;

            async.series([
                    function (callback) {

                        if (timerID) {
                            clearInterval(timerID); // clear Timer from events
                        }

                        node.connection = null;

                        set_node_status_to("connecting");

                        modbusClient.initializeModbusConnection(
                            function (connection, err) {

                                if (err) {
                                    callback(err);

                                } else if (connection) {
                                    set_node_status_to("initialized");
                                    node.connection = connection;
                                    callback();
                                }
                                else {
                                    callback('connection is null without errors');
                                }
                            }, node.name
                        );
                    },
                    function (callback) {

                        if (timerID) {
                            clearInterval(timerID); // clear Timer from events
                        }

                        if (node.connection) {

                            node.connection.on('close', node.receiveEventCloseRead);
                            node.connection.on('connect', node.receiveEventConnectRead);
                            node.connection.on('error', node.receiveEventErrorRead);
                            callback();

                        } else {

                            timerID = setInterval(function () {
                                verbose_log("setInterval in async -> connectModbusSlave");
                                connectModbusSlave();
                            }, retryTime);

                            callback('connection is null - retry in ' + retryTime + ' seconds');
                        }
                    },
                    function (callback) {
                        verbose_warn('connection read async done');
                        callback();
                    }
                ],
                function (err) {
                    if (err) {
                        node.connection = null;
                        node.error(err);
                    }
                }
            );
        }

        verbose_log("init call connectModbusSlave");
        connectModbusSlave();
        connectionInitDone = true;

        node.on("input", function (msg) {

            if (node.connection) {

                if (msg.payload) {

                    try {
                        if (msg.payload.hasOwnProperty('fc')
                            && msg.payload.fc
                            && Number(msg.payload.fc)
                            && msg.payload.fc >= 1
                            && msg.payload.fc <= 4) {

                            verbose_log("FC:" + msg.payload.fc);
                        } else {
                            verbose_warn('msg.payload.fc not valid');
                            return;
                        }

                        if (msg.payload.hasOwnProperty('unitid')
                            && msg.payload.unitid
                            && Number(msg.payload.unitid)
                            && msg.payload.unitid >= 1
                            && msg.payload.unitid <= 255) {

                            verbose_log("UnitId:" + msg.payload.unitid);
                        } else {
                            //verbose_warn('msg.payload.unitid not valid');
                            return;
                        }

                        if (msg.payload.hasOwnProperty('address')
                            && msg.payload.address !== null
                            && msg.payload.address >= 0
                            && msg.payload.address <= 65535) {

                            //verbose_log("Adr:" + msg.payload.address);
                        } else {
                            //verbose_warn('msg.payload.address is not valid');
                            return;
                        }

                        if (msg.payload.hasOwnProperty('quantity')
                            && msg.payload.quantity
                            && Number(msg.payload.quantity)
                            && msg.payload.quantity >= 1
                            && msg.payload.quantity <= 65535) {

                            //verbose_log("Qnt:" + msg.payload.quantity);
                        } else {
                            //verbose_warn('msg.payload.quantity not valid');
                            return;
                        }

                    } catch (err) {
                        verbose_warn('flex parameter not valid' + JSON.stringify(err));
                    }
                } else {
                    verbose_warn('input payload missing');
                    return;
                }

                switch (Number(msg.payload.fc)) {
                    case 1: //FC: 1
                        set_node_status_to("polling");
                        node.connection.readCoils(msg.payload.address, msg.payload.quantity).then(function (resp) {
                            set_node_status_to("active reading");
                            node.send(build_message(resp.coils, resp, msg));
                            set_node_status_to("connected");
                        }).fail(set_modbus_error);
                        break;
                    case 2: //FC: 2
                        set_node_status_to("polling");
                        node.connection.readDiscreteInputs(msg.payload.address, msg.payload.quantity).then(function (resp) {
                            set_node_status_to("active reading");
                            node.send(build_message(resp.coils, resp, msg));
                            set_node_status_to("connected");
                        }).fail(set_modbus_error);
                        break;
                    case 3: //FC: 3
                        set_node_status_to("polling");
                        node.connection.readHoldingRegisters(msg.payload.address, msg.payload.quantity).then(function (resp) {
                            set_node_status_to("active reading");
                            node.send(build_message(resp.register, resp, msg));
                            set_node_status_to("connected");
                        }).fail(set_modbus_error);
                        break;
                    case 4: //FC: 4
                        set_node_status_to("polling");
                        node.connection.readInputRegisters(msg.payload.address, msg.payload.quantity).then(function (resp) {
                            set_node_status_to("active reading");
                            node.send(build_message(resp.register, resp, msg));
                            set_node_status_to("connected");
                        }).fail(set_modbus_error);
                        break;
                    default:
                        set_modbus_error('Invalid FC:' + Number(msg.payload.fc));
                        break;
                }
            } else {
                verbose_log('connection not ready - retry in ' + retryTime + ' seconds');

                if (timerID) {
                    clearInterval(timerID);
                }

                timerID = setInterval(function () {
                    verbose_log("setInterval in ModbusFlexGetter -> connectModbusSlave");
                    connectModbusSlave();
                }, retryTime);
            }
        });

        node.on("close", function () {

            connectionInitDone = false;
            closeCounter = 0;
            verbose_warn("read close");
            clearInterval(timerID);
            set_node_status_to("closed");
            node.receiveEventCloseRead = null;
            node.receiveEventConnectRead = null;
            node.receiveEventErrorRead = null;
            node.connection = null;

        });

        function verbose_warn(logMessage) {
            if (RED.settings.verbose) {
                node.warn((node.name) ? node.name + ': ' + logMessage : 'Modbus Getter: ' + logMessage);
            }
        }

        function verbose_log(logMessage) {
            if (RED.settings.verbose) {
                node.log(logMessage);
            }
        }

        function build_message(values, response, msg) {
            if (msg.payload) {
                msg.payload.values = values;
                msg.payload.response = response;
            }
            return [msg, {payload: response}];
        }

        function set_node_status_to(statusValue) {
            return;
            var statusOptions = mbBasics.set_node_status_properties(statusValue);
            if (mbBasics.statusLog) {
                verbose_log("status options: " + JSON.stringify(statusOptions));
            }
            node.status({
                fill: statusOptions.fill,
                shape: statusOptions.shape,
                text: statusOptions.status
            });
        }

        function set_modbus_error(err) {
            if (err) {
                set_node_status_to("error");
                node.error('Modbus Flex Getter client: ' + JSON.stringify(err));
                return false;
            }
            return true;
        }
    }

    RED.nodes.registerType("modbus-flex-getter", ModbusFlexGetter);
};
