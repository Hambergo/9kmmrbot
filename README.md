# 9kmmrbot

9kmmrbot is a Dota 2-focused Twitch chat bot.

It features many commands that provide information about the ongoing match and other details
about the streamer's Dota 2 profile.

Anyone can request 9kmmrbot to join their channel's chatroom.

## Setting up

This project can be spun up easily using Docker. Review `Dockerfile` and `docker-compose.yml` to see
how the containers are created. Simply execute the following command from within the project directory
to start the bot:

```
COMPOSE_DOCKER_CLI_BUILD=1 docker-compose up --build
```

You might need to `sudo` the above command, or add your user to the appropriate `docker` user group. Refer
to the Docker documentation.

In order for the above command to succeed, a `.env` file must be present in the project root directory. This
file contains the various environment variables required for the bot to connect to Twitch, Steam and MongoDB.

```
STEAM_USER=
STEAM_PASS=
TWITCH_AUTH=
TWITCH_CLIENT_ID=
STEAM_WEBAPI_KEY=
MONGO_URL=
NODE_ENV=
```

* By default, the `MONGO_URL` should be `mongodb://mongodb:27017/{db name}` unless you change the Docker settings.
* The auth token you obtain for the Twitch client should have the `chat:read` and `chat:edit` scopes.
* If you want the bot to write the output in Twitch chat and not just in the console, set `NODE_ENV` to `production`.

Of course, you can always manually start the bot by starting a MongoDB instance and running `node index`. You still
need to set all the environment variables listed above.

## Commands

Before the bot can respond to any commands in your channel, you must request for it to join your channel.

* In the bot's channel, write `!join`
* In your channel, write `!9kmmrbot addacc STEAMID`, where `STEAMID` is your own.

You can link up to 10 Steam IDs to your channel in this way.

Below is a list of commonly used commands. This is not a comprehensive list because some commands are
currently set up to only run in select channels; these commands are not documented.

### Viewer commands

These commands can be invoked by anyone in your channel.

<details>
<summary>List of commands</summary>

| Command | Aliases | Description |
| --- | --- | --- |
| `!notableplayers` | `!np`, `!notable` | Show notable players in the game |
| `!gamemedals` | `!gm` | Show medals of all players in the game |
| `!score` | `!wl`, `!record` | Show number of games won or lost during the current stream |
| `!medal` | none | Show the best medal of the streamer (across all linked accounts) |
| `!lastgame` | `!lg` | Show players in the current game that played with the streamer in the last game |

</details>

### Streamer commands

These commands can only be invoked if you are the channel's broadcaster.

<details>
<summary>List of commands</summary>

| Command | Description |
| --- | --- |
| `!9kmmrbot addmod NAME` | Adds `NAME` to the list of 9kmmrbot mods in your channel |
| `!9kmmrbot delmod NAME` | Removes `NAME` from the list of 9kmmrbot mods in your channel |

</details>

### Moderator commands

These commands can be invoked if you are the channel's broadcaster, or if you are a 9kmmrbot moderator in the channel.

<details>
<summary>List of commands</summary>

| Command | Description |
| --- | --- |
| `!9kmmrbot addacc STEAMID` | Adds `STEAMID`<sup>1</sup> to your channel's accounts |
| `!9kmmrbot delacc STEAMID` | Removes `STEAMID` from your channel's accounts |
| `!9kmmrbot listacc` | Lists all Steam accounts linked to this channel |
| `!9kmmrbot addnp STEAMID NICK` | Adds `STEAMID` as a notable player in your channel with nickname `NICK` |
| `!9kmmrbot delnp STEAMID` | Removes `STEAMID` as a notable player from your channel |
| `!9kmmrbot toggleself` | Toggle showing<sup>2</sup> the streamer in the list of notable players |
| `!9kmmrbot toggleemotes` | Toggle showing hero names as emotes<sup>3</sup> |
| `!9kmmrbot cd` | Writes the cooldown (in seconds) for commands in this channel |
| `!9kmmrbot cd set SECONDS` | Sets the cooldown for commands in this channel to `SECONDS`<sup>4</sup> seconds |
| `!9kmmrbot delay` | Writes whether there is a delay on the `!notableplayers` command in the channel |
| `!9kmmrbot delay set SECONDS` | Sets the delay on the `!notableplayers` command in the channel to `SECONDS`<sup>5</sup> seconds |
| `!9kmmrbot delay on`<br />`!9kmmrbot delay off` | Turns the delay<sup>6</sup> on the `!notableplayers` command in the channel on or off. |
| `!9kmmrbot id HERO` | Writes the friend ID of the player playing `HERO`<sup>7</sup> in the current game |

<details>
<summary>Notes</summary>

1: Use a tool like [steamid.io](https://steamid.io/) to find your Steam ID. You can use any representation (steamID, steamID3, steamID64).<br />
Alternatively, you can also just use the friend ID from in-game or Dotabuff/OpenDota/Stratz.<br />
2: The streamer must still be added to the list of notable players in the channel to show up.<br />
3: Emotes need to enabled on the channel by a 9kmmrbot Global Moderator using the `emotes add` command (see below).
4: `SECONDS` must be a number between 30 and 300.<br />
5: `SECONDS` must be a number between 30 and 600 divisible by 30.<br />
6: If a delay is present, the bot will respond as through the command was invoked in the past.<br />
7: `HERO` must exactly match the localized (English) hero name (case-insensitive).

</details>

</details>

### Global moderator commands

These commands can only be invoked if you are on the list of Global Moderators for 9kmmrbot.

<details>
<summary>List of commands</summary>

| Command | Description |
| --- | --- |
| `!9kmmrbot addglobalnp STEAMID NICK` | Adds `STEAMID` as a global notable player with nickname `NICK` |
| `!9kmmrbot delglobalnp STEAMID` | Removes `STEAMID` as a global notable player |
| `!9kmmrbot join CHANNEL` | Makes the bot join the Twitch channel with name `CHANNEL`<sup>1</sup> |
| `!9kmmrbot part CHANNEL` | Makes the bot leave the Twitch channel with name `CHANNEL` |
| `!9kmmrbot addemotes EMOTE1[ EMOTE2 EMOTE3...],HERO` | Adds the `EMOTE`s<sup>2</sup> as representations for `HERO` |
| `!9kmmrbot delemotes EMOTE1[ EMOTE2 EMOTE3...]` | Stops the bot from using the `EMOTE`s for hero names |
| `!9kmmrbot listemotes` | Lists all emotes being used in place of hero names |

<details>
<summary>Notes</summary>

1: `CHANNEL` should match the channel's (login) name, not its numerical ID.<br />
2: The `EMOTE`s must be available for the bot to use.

</details>

</details>