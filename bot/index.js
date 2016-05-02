const TGBot = require('node-telegram-bot-api');

const token = process.env.TG_BOT_TOKEN;
const feedbackChat = process.env.CHAT_ID;
const api = require('./api');

var bot;
if (process.env.NODE_ENV === 'production') {
	bot = new TGBot(token);
	bot.setWebHook('https://bot.kanttiinit.fi/' + token);
} else {
	bot = new TGBot(token, {
		polling: true
	});
}

require('./feedback')(bot);
require('./help')(bot);

function postRestaurantWithID(chatID, restaurantID) {
	api.getRestaurantImage(restaurantID)
	.then( image => {
		bot.sendPhoto(chatID, image);
	}).catch( error => {
		bot.sendMessage(chatID, 'Error with restaurant: ' + restaurantID);
	});
};

function postRestaurantWithName(chatID, restaurantName) {
	api.getRestaurantID(restaurantName)
	.then( restaurantID => {
		postRestaurantWithID(chatID, restaurantID);
	}).catch( error => {
		bot.sendMessage(chatID, 'Invalid restaurant :(');
	});
};

function postRestaurantText(chatID, restaurantID) {
	api.getRestaurantText(restaurantID)
	.then( menuText => {
		bot.sendMessage(chatID, menuText, {parse_mode:'HTML'});
	}).catch( error => {
		bot.sendMessage(chatID, 'Could not parse restaurant: ' + restaurantID);
	});
};


bot.onText(/^\/(.*)?niemi/, (msg, match) => {
	if(msg.chat.type === 'private') {
		api.getAreaRestaurants('otaniemi')
		.then( restaurants => {
			restaurants
			.map( restaurant => restaurant.id)
			.forEach( restaurant => {
				postRestaurantText(msg.chat.id, restaurant);
			});
		});
	} else {
		bot.sendMessage(msg.chat.id, "I don't want to spam group chats. Try /niemi in private!");
	}
});

/*TODO: FIX WEIRD PARSING BUG BEFORE RELEASE
bot.onText(/^\/(helsinki|hki|((.*)?keskusta))/, (msg, match) => {
	if(msg.chat.type === 'private') {
		api.getAreaRestaurants('helsingin keskusta')
		.then( restaurants => {
			restaurants
			.map( restaurant => restaurant.id)
			.forEach( restaurant => {
				postRestaurantText(msg.chat.id, restaurant);
			});
		});
	} else {
		bot.sendMessage(msg.chat.id, "I don't want to spam group chats. Try /hki in private!");
	}
});
*/

bot.onText(/^\/töölö/, (msg, match) => {
	if(msg.chat.type === 'private') {
		api.getAreaRestaurants('töölö')
		.then( restaurants => {
			restaurants
			.map( restaurant => restaurant.id)
			.forEach( restaurant => {
				postRestaurantText(msg.chat.id, restaurant);
			});
		});
	} else {
		bot.sendMessage(msg.chat.id, "I don't want to spam group chats. Try /töölö in private!");
	}
});

function postClosestRestaurants(msg, n) {
	api.getClosestRestaurants(msg.location, n)
	.then( restaurants => {
		restaurants.forEach( restaurant => {
			postRestaurantWithID(msg.chat.id, restaurant.id);
		});
	});
};

bot.onText(/^\/food/, (msg, match) => {
	if(msg.chat.type === 'private') {
		bot.sendMessage(msg.chat.id, 'Can I use your location?', {
			'reply_markup':{
				'keyboard':[[{
					'text':'Sure, use my location!',
					'request_location':true
				}], [{
					'text':"No, don't use my location.",
					'hide_keyboard':true
				}]],
				'resize_keyboard':true,
				'one_time_keyboard':true,
				'selective':true
			}
		});
	} else {
		bot.sendMessage(msg.chat.id, 'The /food command only works in private chats :(');
	}
});

bot.onText(/No, don't use my location./, (msg, match) => {
	bot.sendMessage(msg.chat.id, "Feel free to use the /menu command, then :)");
});

bot.onText(/^\/menu(@Kanttiini(.+))?$/, (msg, match) => {
	bot.sendMessage(msg.chat.id, 'Give me a restaurant name or ID, please. \nYou can get them with /restaurants ');
});

bot.onText(/^\/(menu|img) (.+)$/, (msg, match) => {
	const requested = match[2].toLowerCase();
	const chatID = msg.chat.id;
	if (isNaN(requested)) {
		postRestaurantWithName(chatID, requested);
	} else {
		postRestaurantWithID(chatID, requested);
	}
});

bot.onText(/^\/txt (.+)$/, (msg, match) => {
	const requested = match[1].toLowerCase();
	const chatID = msg.chat.id;
	if (isNaN(requested)) {
		api.getRestaurantID(requested)
		.then( restaurantID => {
			postRestaurantText(chatID, restaurantID);
		});
	} else {
		postRestaurantText(chatID, requested);
	}
});

bot.onText(/^\/sub/, (msg, match) => {
	api.getSubway()
	.then( subway => {
			bot.sendMessage(msg.chat.id, subway);
	})
	.catch( error => {
			bot.sendMessage(msg.chat.id, 'No subway today :(');
	});
});

bot.onText(/^\/restaurants/, (msg, match) => {
	api.getRestaurants()
	.then( restaurantString => {
		bot.sendMessage(msg.chat.id, restaurantString);
	})
});

bot.on('location', (msg, match) => {
	postClosestRestaurants(msg, 3);
});

/*TODO: RETHINK THIS
bot.on('inline_query', (msg) => {
	json('https://api.kanttiinit.fi/restaurants')
	.then(restaurants => {
		const results = [];
		const restaurant = restaurants.find(r => r.name.match(new RegExp('^' + msg.query, 'i')));
		if (restaurant) {
			const restaurantID = restaurant.id;
			const restaurantName = restaurant.name;
			json('https://api.kanttiinit.fi/menus/' + restaurantID)
			.then(restaurant => {
				const items = restaurant[0].Menus[0].courses
					.map(c => c.title)
					.join('\n');
				const menuMessage = 'https://api.kanttiinit.fi/restaurants/' + restaurantID + '/image';
				const result1 = {
					'type':'article',
					'id':msg.id,
					'title':restaurantName,
					'description':items,
					'input_message_content': {
						'message_text':menuMessage
					},
					'thumb_url':'https://api.kanttiinit.fi/restaurants/' + restaurantID + '/image',
					'thumb_width': 100,
					'thumb_height': 100
				};
				results.push(result1);
				bot.answerInlineQuery(msg.id, results);
			});
		} else {
			bot.answerInlineQuery(msg.id, []);
		}
	});
});
*/

module.exports = bot;
