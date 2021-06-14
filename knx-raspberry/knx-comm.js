module.exports = function(RED) {

    function KnxCommNode(config) {

        RED.nodes.createNode(this,config);

        this.port = config.serialport;

        const SerialPort = require('serialport')

        this.serial = new SerialPort(this.port, {
            baudRate: 19200
        })


        //Query for avaible serial ports
        RED.httpAdmin.get("/serialports", RED.auth.needsPermission('serial.read'), function(req,res) {
            SerialPort.list().then(
                port => {
                    const ports = port.map(e => e.path);
                    res.json(ports);
                },
                err => {
                    res.json([RED._("serial.errors.list")]);
                }
            )
        });
    

        this.on('close',() => {
            this.serial.close()
        })

    }
    
    RED.nodes.registerType("knx-comm",KnxCommNode);
}
