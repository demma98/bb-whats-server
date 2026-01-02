import Whatsapp from "whatsapp-web.js";
const {Client, LocalAuth} = Whatsapp;

import qrcode from "qrcode-terminal";

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

const client = new Client({
	puppeteer: {
		executablePath: "/usr/bin/chromium"
		, args: [
			"--no-sandbox",
			]
		, headless: true
	}
	, authStrategy: new LocalAuth()
});

var client_ready = false

client.on("ready", () => {
	console.log("client ready");
	client_ready = true;
});

client.on("qr", qr => {
	qrcode.generate(qr, {small:true});
});

client.on("message_create", async (msg) => {
	let chat = await msg.getChat();
	if(chat.isGroup){
		console.log("from group", chat.name);
		if(msg.fromMe == true)
			console.log("you:")
		else
			console.log(msg._data.notifyName+":");
	}
	else{
		if(msg.fromMe == true)
			console.log("you to "+chat.name+":");
		else
			console.log(chat.name, ":");
	}
	
	console.log(msg.body);
	
	if(msg.body == "test"){
		console.log("-------");
		console.log(msg);
		console.log("-------");
		console.log(chat);
		console.log("-------");
	}
}),

client.initialize();

/*
app.listen(port, () =>{
	console.log("server started on port", port);
});

app.use("/", (req, res) => {
	//res.sendFile('/index.html', {root: __dirname});
	console.log("req");
	res.send("hello");
});
*/

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
		
		if(client_ready){
			
			if(d_json.req == "chats"){
				r_json.req = "chats"
			
				let chats = await client.getChats();
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
				let chat = await client.getChatById(d_json.id);

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
							if(r_json.names[i] == null)
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
					
					let id = await client.sendMessage(d_json.id, d_json.body, m_options);
		
					r_json.id = id;
					r_json.status = "success";
				}
			}

			console.log(r_json);
			stream.write(JSON.stringify(r_json)+"\n", "utf8");
		}
		else {
			console.log("client is not ready")
						stream.write(JSON.stringify({status:"failed", cause: "server not ready"})+"\n", "utf8");
		}
	});
})

server.listen(port, () => {
	console.log("server ready", port);
});
