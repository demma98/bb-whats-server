import Whatsapp from "whatsapp-web.js";
const {Client, LocalAuth} = Whatsapp;

import qrcode from "qrcode-terminal";

import random from "seeded-random"

/*
import express from "express";
const app = express();
const port = 80

import {fileURLToPath} from "url";
import {dirname} from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
*/

import net from "net";

const port = 9000;

const clients = [];
var clients_ready = [];
var clients_created = [];
var clients_auth = [];
var clients_passwords = [];

const server = net.createServer((stream) => {

	stream.on('connect', (ws, stream) => {
		console.log("socket request");
	});
	
	stream.on("end", () => {
			console.log("closed");
	});

	stream.on("keylog", (keylog) => {
		console.log("key", keylog.toString());
	});

	stream.on("data", async(__data) => {
		const data = __data.toString();
		console.log(data);

		const d_json = JSON.parse(data);

		
		var r_json = {};
		r_json.status = "failed";

		if(d_json.req == "login"){
			if(clients[d_json.num] != null){
				try{
					clients[d_json.num].logout();
				}
				catch (error) {
					console.log(error);
				}
			}

			console.log("new client");
			clients[d_json.num] = new Client({
				puppeteer: {
					executablePath: "/usr/bin/chromium"
					, args: [
						"--no-sandbox",
						]
					, headless: true
				}
				, authStrategy: new LocalAuth({clientId:[d_json.num]})
			});

			clients_ready[d_json.num] = false;
			clients_auth[d_json.num] = false;
			clients_created[d_json.num] = true;
			
			clients[d_json.num].on("ready", () => {
				console.log("client", d_json.num, "ready");
			});

			clients[d_json.num].on("qr", qr => {
				console.log("created ", d_json.num);
				qrcode.generate(qr, {small:true});
				clients_created[d_json.num] = true;
				clients_ready[d_json.num] = false;
				clients_auth[d_json.num] = false;
			});


			clients[d_json.num].on("authenticated", () => {
				console.log("authenticated ", d_json.num);
				clients_auth[d_json.num] = true;
			});

			console.log("init", d_json.num);
			clients[d_json.num].initialize();

			r_json.status = "success";
			r_json.pad = "pad";
		}
		else if(d_json.req == "code"){
			if(clients_created[d_json.num] && clients_auth[d_json.num] && !clients_ready[d_json.num]){
				r_json.password = random.range(Date.now().toString(), 10000000000000000000000000000000, 99999999999999999999999999999999).toString();
				clients_passwords[d_json.num] = r_json.password;
				clients_ready[d_json.num] = true;

				r_json.status = "success";
			}
			else{
				r_json.cause = "client " + d_json.num + " not ready";
				console.log(clients_created[d_json.num], clients_auth[d_json.num], clients_ready[d_json.num]);
			}
			r_json.auth = clients_auth[d_json.num].toString();
			r_json.pad = "pad";
		}
		else if(clients_ready[d_json.num] && clients_passwords[d_json.num] == d_json.password){
		
			if(d_json.req == "chats"){
				r_json.req = "chats"
			
				let chats = await clients[d_json.num].getChats();
				r_json.chats=[];
				r_json.ids=[];
				
				for(let i = 0; i < chats.length && i < 25; i++){
					console.log(chats[i].name);
					r_json.chats[i] = chats[i].name;
					r_json.ids[i] = chats[i].id._serialized;
				}
				
				r_json.status = "success";
			}
			
			else if(d_json.req == "messages") {
				let chat = await clients[d_json.num].getChatById(d_json.id);

				let messages = await chat.fetchMessages(25);
				console.log("messages:",messages.length)

				r_json.messages = [];
				r_json.ids = [];
				r_json.fromMe = [];
				r_json.name = chat.name;


				let off = 0;
				if(messages.length > 25)
					off = messages.length - 25;
				
				if(chat.isGroup){
					r_json.names = [];
				}
				for(let i = 0; i + off < messages.length; i++){
					if(messages[i].id._serialized.length == 0){
						i--;
					}
					else {
						r_json.messages[i] = messages[i + off].body;
						r_json.ids[i] = messages[i + off].id._serialized;
						r_json.fromMe[i] = messages[i + off].fromMe.toString();
						
						if(chat.isGroup){
							if(i == 0)
								console.log(messages[i + off]);
							r_json.names[i] = messages[i + off]._data.notifyName;
							if(r_json.names[i] == null || r_json.names[i] == "")
								r_json.names[i] = messages[i + off].author;
						}
					}
				}
				

				r_json.isGroup = chat.isGroup;
				r_json.name = chat.name;
				r_json.status = "success";
			}
			else if(d_json.req == "send"){
				if(d_json.body != ""){
					let m_options = {};
					
					if(d_json.replyTo != "" && d_json.replyTo != null)
						m_options.quotedMessageId = d_json.replyTo
					
					let id = await clients[d_json.num].sendMessage(d_json.id, d_json.body, m_options);
		
					r_json.id = id;
					r_json.status = "success";
				}
			}

		}
		else {
			console.log("client is not ready");
			console.log(clients_ready[d_json.num], clients_passwords[d_json.num]);
			r_json.cause = "client not ready";
			r_json.exists = (clients[d_json.num] != null && clients[d_json.num] != "");
		}
		
		console.log(r_json);
		stream.write(JSON.stringify(r_json)+"\n", "utf8");
	});
})

server.listen(port, () => {
	console.log("server ready", port);
});
