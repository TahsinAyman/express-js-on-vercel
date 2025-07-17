require('dotenv').config();

const express = require('express');
const app = express();
const { sql } = require('@vercel/postgres');

const bodyParser = require('body-parser');
const path = require('path');

const Mineflayer = require('mineflayer');
const { sleep, getRandom } = require("./utils.js");
const { readFileSync } = require('fs');

const CONFIG = JSON.parse(readFileSync(path.join(__dirname, '../config.json'), 'utf-8'));

// Create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false });

app.use(express.static('public'));

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, '..', 'components', 'home.htm'));
});

app.get('/about', function (req, res) {
	res.sendFile(path.join(__dirname, '..', 'components', 'about.htm'));
});

app.get('/uploadUser', function (req, res) {
	res.sendFile(path.join(__dirname, '..', 'components', 'user_upload_form.htm'));
});

app.post('/uploadSuccessful', urlencodedParser, async (req, res) => {
	try {
		await sql`INSERT INTO Users (Id, Name, Email) VALUES (${req.body.user_id}, ${req.body.name}, ${req.body.email});`;
		res.status(200).send('<h1>User added successfully</h1>');
	} catch (error) {
		console.error(error);
		res.status(500).send('Error adding user');
	}
});

app.get('/allUsers', async (req, res) => {
	try {
		const users = await sql`SELECT * FROM Users;`;
		if (users && users.rows.length > 0) {
			let tableContent = users.rows
				.map(
					(user) =>
						`<tr>
                        <td>${user.id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                    </tr>`
				)
				.join('');

			res.status(200).send(`
                <html>
                    <head>
                        <title>Users</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-bottom: 15px;
                            }
                            th, td {
                                border: 1px solid #ddd;
                                padding: 8px;
                                text-align: left;
                            }
                            th {
                                background-color: #f2f2f2;
                            }
                            a {
                                text-decoration: none;
                                color: #0a16f7;
                                margin: 15px;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>Users</h1>
                        <table>
                            <thead>
                                <tr>
                                    <th>User ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableContent}
                            </tbody>
                        </table>
                        <div>
                            <a href="/">Home</a>
                            <a href="/uploadUser">Add User</a>
                        </div>
                    </body>
                </html>
            `);
		} else {
			res.status(404).send('Users not found');
		}
	} catch (error) {
		console.error(error);
		res.status(500).send('Error retrieving users');
	}
});




let loop: NodeJS.Timeout;
let bot: any;

const disconnect = (): void => {
	clearInterval(loop);
	bot?.quit?.();
	bot?.end?.();
};
const reconnect = async (): Promise<void> => {
	console.log(`Trying to reconnect in ${CONFIG.action.retryDelay / 1000} seconds...\n`);

	disconnect();
	await sleep(CONFIG.action.retryDelay);
	createBot();
	return;
};

const createBot = (): void => {
	bot = Mineflayer.createBot({
		host: CONFIG.client.host,
		port: +CONFIG.client.port,
		username: CONFIG.client.username
	} as const);


	bot.once('error', error => {
		console.error(`AFKBot got an error: ${error}`);
	});
	bot.once('kicked', rawResponse => {
		console.error(`\n\nAFKbot is disconnected: ${rawResponse}`);
	});
	bot.once('end', () => void reconnect());

	bot.once('spawn', () => {
		const changePos = async (): Promise<void> => {
			const lastAction = getRandom(CONFIG.action.commands) as any;
			const halfChance: boolean = Math.random() < 0.5? true : false; // 50% chance to sprint

			console.debug(`${lastAction}${halfChance? " with sprinting" : ''}`);

			bot.setControlState('sprint', halfChance);
			bot.setControlState(lastAction, true); // starts the selected random action

			await sleep(CONFIG.action.holdDuration);
			bot.clearControlStates();
			return;
		};
		const changeView = async (): Promise<void> => {
			const yaw = (Math.random() * Math.PI) - (0.5 * Math.PI),
				pitch = (Math.random() * Math.PI) - (0.5 * Math.PI);
			
			await bot.look(yaw, pitch, false);
			return;
		};
		
		loop = setInterval(() => {
			changeView();
			changePos();
		}, CONFIG.action.holdDuration);
	});
	bot.once('login', () => {
		console.log(`AFKBot logged in ${bot.username}\n\n`);
	});
};



createBot();


app.listen(3000, () => console.log('Server ready on port 3000.'));

module.exports = app;
