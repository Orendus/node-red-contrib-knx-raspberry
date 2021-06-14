module.exports = function(RED) {

    function KnxObjectNode(config) {

        RED.nodes.createNode(this,config)

        const knxDatapoints = require('knx-datapoints')

        this.dpt = config.dpt
        this.grp = config.grp

        //instance communication with serialPort
        this.serial = RED.nodes.getNode(config.serialport)
        this.port = this.serial.serial
        
        this.on('input', function(m) {
            if(m.topic=='read')
            {
                 this.port.write(pollKnx(this.grp))

            }
            else
            {
                if(m.topic!=undefined && m.topic!=null && m.topic.match(/\d{1,2}\/\d{1,2}\/\d{1,3}/)) //group address
                {
                    this.grp = (m.topic.match(/\d{1,2}\/\d{1,2}\/\d{1,3}/)[0]==m.topic.match(/\d{1,2}\/\d{1,2}\/\d{1,3}/).input) ? m.topic : this.grp
                }
                this.port.write(writeKnx(m.payload,this.grp,this.dpt))
            }
        })

        if(this.serial)
        {
            this.port.on('open',() => {
                this.status({fill:"green",shape:"dot",text:"connected"});
            })

            this.port.on('close',() => {
                this.status({fill:"red",shape:"dot",text:"not connected"});
            })

            this.port.on('data',(m) => {
                const message = {payload:readKnx(m,this.grp,this.dpt),topic:this.grp}

                if(message.payload!=null && message.payload!=undefined) this.send(message)
            })
        }
        else
        {
            this.status({fill:"red",shape:"dot",text:"not connected"});
        }


        function writeKnx(val,group,datapoint){
            const STX = String.fromCharCode(0x2)
            const ETX = String.fromCharCode(0x3)

            const TARGET = group.split('/').map(el => Number(el))
            const VALUE = val
            const DPT = datapoint

            const CTRLFLD = "82" //Control Field

            let telegramInfo = String(6 + (DPT < 9)).padStart(2,0)

            //target address
            let targetHiByte = ((TARGET[0]<<3)+TARGET[1]).toString(16).padStart(2,0)
            let targetLowByte = TARGET[2].toString(16).padStart(2,0)

            let payloadData = knxDatapoints.encode(DPT.toString(),VALUE).toString('hex')


            let message = CTRLFLD+telegramInfo+targetHiByte+targetLowByte+payloadData

            function getCrc(m){
                let elements = m.split('').reduce((a,c,i) => a+c+(i%2==1?',':'')).split(',').map(a => parseInt(a,16))
                return elements.reduce((a,c) => a ^ c).toString(16).padStart(2,0)
            }

            //compone il messaggio da inviare
            return STX+message+getCrc(message)+ETX
        }

        function readKnx(msg,group,datapoint) {
            const STX = String.fromCharCode(0x2)
            const ETX = String.fromCharCode(0x3)
            
            const message = msg.filter(el => el!= 0 && el!=2 && el!=3)
                            .toString()
                            .split('')
                            .reduce((a,c,i,ar) => a+c+(i%2==1 && i<ar.length-1 ?',':''))
                            .split(',')
                            
                            
            const crc = message.pop()
            
            const controlField = message.shift()
            const telegramInfo = message.shift()
            const sourceHiByte = parseInt(message.shift(),16)
            const sourceLowByte = parseInt(message.shift(),16)
            const grpHiByte = parseInt(message.shift(),16)
            const grpLowByte = parseInt(message.shift(),16)
            let mess = {}
            
            function getSourceAddr(hiByte,lowByte){
                return (hiByte>>4&0xF).toString()+'.'+(hiByte&0x0F).toString()+'.'+lowByte.toString()
            }
            
            function getTargetAddr(hiByte,lowByte){
                return (hiByte>>3&0x1F).toString()+'/'+(hiByte&0x07).toString()+'/'+lowByte.toString()
            }
            
            /* --- CONTROL FIELDS ---
            
            0x41 Group monitor Value response
            0x42 Group monitor Value write
            0x43 Request of reading Value
            0x4F ACK or NAK as reply to value read or write
            0x48 KNX BCU status
            0x49 KNX BCU version
            0x45 KNX BCU individual address
            
            */
            
            switch(controlField)
            {
                case '4F': //ACK or NAK
                {
                    break
                }
                case '41': //Group monitor Value response
                case '42': //Group monitor Value write
                {
                    mess = {
                        src : getSourceAddr(sourceHiByte,sourceLowByte),
                        grp : getTargetAddr(grpHiByte,grpLowByte),
                        val : message
                    }
                    break
                }
            }
            if(mess.grp == group)
            {
                let value = mess.val.map(a => parseInt(a,16))
                return knxDatapoints.decode(datapoint, Buffer.from(value,'hex'))
            }
        }

        function pollKnx(group){
            const STX = String.fromCharCode(0x2)
            const ETX = String.fromCharCode(0x3)
            
            const TARGET = group.split('/').map(el => Number(el))
            
            const CTRLFLD = "81" //Control Field
            
            let telegramInfo = "06"
            
            //target address
            let targetHiByte = ((TARGET[0]<<3)+TARGET[1]).toString(16).padStart(2,0)
            let targetLowByte = TARGET[2].toString(16).padStart(2,0)
            
            let message = CTRLFLD+telegramInfo+targetHiByte+targetLowByte
            
            function getCrc(msg){
                let elements = msg.split('').reduce((a,c,i) => a+c+(i%2==1?',':'')).split(',').map(a => parseInt(a,16))
                return elements.reduce((a,c) => a ^ c).toString(16).padStart(2,0)
            }
 
            //compone il messaggio da inviare
            return STX+message+getCrc(message)+ETX
        }
    }

    RED.nodes.registerType("knx-object",KnxObjectNode);

}