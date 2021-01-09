const Discord = require('discord.js');
const client = new Discord.Client();
const ytdl = require('ytdl-core');
const request = require('request');
const fs = require('fs');
const getYouTubeID = require('get-youtube-id');
const fetch = require('node-fetch');
var queue = [];
var queueNames = [];
var isPlaying = false;
var connection = null;
var dispatcher = null;
var volume = 0.5;

var config = JSON.parse(fs.readFileSync('./settings.json', 'utf-8'));
const weatherBase = "http://api.openweathermap.org/data/2.5/weather?q=";

const yt_api_key = config.yt_api_key;
const weather_api_key = config.weather_api_key;
const discord_token = config.discord_token;
const prefix = config.prefix;
const client_id = config.client_id

client.login(discord_token);

client.on('ready', () => {
    console.log('I am ready!');
    client.user.setUsername("Maestro");
});

client.on('message', async message => {
    var content = message.content.toLowerCase();
    var channel = message.channel;
    var args = message.content.split(' ').filter(function(value, index, arr){return value != ''}); // Get the individual words of the message

    if(message.author.id == client_id){ // If the message was sent by the bot, ignore it
        return
    }

    if (content.startsWith(prefix + "play")) {

        if (message.member.voice.channel) {
            connection = await message.member.voice.channel.join(); // Join the channel and get a connection

            if (queue.length > 0 || isPlaying) {
                getID(content.slice(6), function (id, title) { // Use getID to fetch the youtube id
                    addToQueue(id);
                    message.reply(":musical_note: Added to Queue: **" + title + "**");
                    queueNames.push(title)
                });
            } else {
                isPlaying = true;
                getID(content.slice(6), function (id, title) { // Same as above, but play the track
                    playMusic(connection, id, message);
                    addToQueue(id, title)
                    message.reply(":musical_note: Now Playing: **" + title + "**");
                    queueNames.push(title)
                });
            }

        } else {
            message.reply('You need to join a voice channel first!');
        }

    }

    if (content.startsWith(prefix + "skip")) {
        queue.shift(); // Go to next song
        if (queue.length == 0) {
            console.log("Song skipped: No more songs, so ending.")
            queue = [];
            isPlaying = false;
        } else {
            console.log("Song skipped: More songs in queue, attempting to play first one.")
            playMusic(connection, queue[0], message);
        }
    }

    if (content.includes(prefix + "volume")) {
        volume = parseInt(content.slice(10))
        message.channel.send("Volume set to " + volume)
        if (volume >= 5) {
            message.channel.send("WARNING: Stable volumes are between 0 and 3. Selected volume may blow your eardrums. I am not responsible for hearing loss.")
        }
        message.channel.send("All future songs will be played at selected volume until changed. This won't affect the current song. I'm working on it.")
    }

    if (content.includes(prefix + "leave")) {
        if(queue.length != 0) queue = []; // Clear the queue
        if (message.member.voice.channel) {
            message.channel.send("Ok I left the voice channel.");
            console.log("Left voice.");
            await message.member.voice.channel.leave();
        } else {
            message.reply('An error occured while trying to leave your voice channel!');
        }
    }

    if (content.includes(prefix + "queue")) {
        message.channel.send("Songs in queue:")
        for (i = 0; i < queue.length; i++) { // List all songs in the queue, in order
            if (i == 0) {
                message.channel.send("**Now playing:** " + queueNames[i])
            } else {
                message.channel.send("**" + i + ":** " + queueNames[i])
            }
        }
    }

    if (content.includes(prefix + "help")) {
        message.author.send("Currently, the existing commands are: help, dice, d20, user, randommessage voice, weather, play, volume, queue, laugh and leave. Start all commands with a '![command]'.");
    }

    if (content.includes(prefix + "voice")) {
        if (message.member.voice.channel) {
            channel.send("@" + message.member.nickname + ", Ok, joining your voice channel now");
            await message.member.voice.channel.join()
        } else {
            message.reply('You need to join a voice channel first!');
        }
    }

    if (content.includes(prefix + "weather")) {
        var location = content.slice(9);

        if (location.length > 0) {
            url = weatherBase + location + "&APPID=" + weather_api_key;
            fetch(url) // Fetch the weather data from the api
                .then(res => res.json())
                .then(json => {
                    console.log(json)
                    // Check for errors
                    if(json.cod == '404'){
                        message.channel.send("City not found.")
                    } else if(json.cod != '200'){
                        message.channel.send("An unknown error occurred.")
                    } else {
                        weatherEmbed = new Discord.MessageEmbed() // Create an embed with the information in the json
                        .setTitle("**Maestro's Weather Report for " + json.name + "**")
                        .setColor("#0099ff")
                        .addField("Current temperature:", Math.round(json.main.temp - 273.15) + "C/" + Math.round((json.main.temp * 9 / 5) - 459.67) + "F")
                        .addField("Looks like:", json.weather[0].description)
                        .addField("Humidity: ", json.main.humidity + "%")
                        .addField("Wind Speed: ", json.wind.speed + " m/s")
                        .addField("Cloudiness: ", json.clouds.all + "%")
                    message.channel.send(weatherEmbed);
                    }

                })
                .catch(err => console.error(err));

        } else {
            message.channel.send("Please supply a location.");
        }

    }

    if (content.includes(prefix + "dice")) {
        var number = Math.floor(Math.random() * 6) + 1;
        message.reply("The dice rolled onto " + number)
    }

    if (content.includes(prefix + "d20")) {
        var number = Math.floor(Math.random() * 20) + 1;
        message.reply("The dice rolled onto " + number)
    }

    if (message.content.includes(prefix + "user")) {
        message.reply(message.author.avatarURL);
        message.reply(message.author.username);
    }

    if (content.includes(prefix + "randommessage")) {
        rand = Math.floor(Math.random() * 100)
        channel.messages.fetch({ limit: 100 }) // Fetch the last 100 messages (Find a way to fetch more?)
            .then(messages => {
                channel.send('"' + messages.array()[rand].content + '" - ' + messages.array()[rand].author.username) // Convert to an array and select a random message to display
            })
            .catch(console.error)
    }

    // This one is really dumb
    if (message.content.includes(prefix + "laugh")) {
        if (message.member.voice.channel) {
            connection = await message.member.voice.channel.join(); // Join voice
            stream = ytdl("https://www.youtube.com/watch?v=iYVO5bUFww0", { filter: "audioonly" }); // Create stream of laugh track
            dispatcher = connection.play(stream); // Play it
        } else {
            message.channel.send("You need to be in a voice channel first!")
        }
    }

    if (message.content.includes("<@!"+client_id+">")) {
        console.log(args)
        console.log("Bot mentioned by " + message.author.username + ".")
    }

});



function isYoutube(str) {
    return str.indexOf("youtube.com") > -1;
}

function searchVideo(query, callback) { // Use the youtube api to search videos according to the user's query
    request("https://www.googleapis.com/youtube/v3/search?part=id,snippet&type=video&q=" + encodeURIComponent(query) + "&key=" + yt_api_key, function (error, response, body) {
        var json = JSON.parse(body);
        callback(json.items[0].id.videoId, json.items[0].snippet.title); // Pass back the id and title
    });
}

function getID(str, cb) {
    if (isYoutube(str)) { // If passed a url, play it
        cb(getYouTubeID(str));
    } else { // If passed a search term, search it using the youtube api
        searchVideo(str, function (id, title) {
            cb(id, title);
        });
    }
}

function addToQueue(strID) {
    if (isYoutube(strID)) {
        queue.push(getYouTubeID(strID));
    } else {
        queue.push(strID);
    }
}

function playMusic(connection, id, message) {

    stream = ytdl("https://www.youtube.com/watch?v=" + id, { filter: "audioonly" });

    dispatcher = connection.play(stream);
    dispatcher.setVolume(volume)

    dispatcher.on('start', () => {
        console.log('Audio is now playing!');
    });

    dispatcher.on('finish', function () {
        queue.shift();
        if (queue.length == 0) {
            console.log("Song skipped: No more songs, so ending.")
            queue = [];
            isPlaying = false;
        } else {
            console.log("Song skipped: More songs in queue, attempting to play first one.")
            playMusic(connection, queue[0], message);
        }
    });

}

