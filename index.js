import express from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  EmbedBuilder,
  PermissionsBitField,
} from "discord.js";
import { fileURLToPath } from "url";
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
} from "@discordjs/voice";
import googleTTS from "google-tts-api";
import https from "https";
import { Readable } from "stream";

dotenv.config();

// --- Web server giữ cho Render không ngủ ---
const app = express();

app.get("/", (req, res) => {
  res.set("Content-Type", "text/plain"); // ép trả về text thuần
  res.status(200).send("OK");
  console.log("✅ Ping received");
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`🌐 Web server running at ${process.env.PORT || 3000}`);
});

// --- Setup Discord client ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((file) => file.endsWith(".js"));

  for (const file of commandFiles) {
    const command = await import(`./commands/${file}`);
    client.commands.set(command.default.data.name, command.default);
  }
}

// --- Interaction handler ---
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction, client);
  } else if (interaction.isButton()) {
    const [action, messageId] = interaction.customId.split("_");
    const config = JSON.parse(fs.readFileSync("./config.json", "utf8"));

    if (
      !interaction.memberPermissions.has(
        PermissionsBitField.Flags.ManageMessages
      )
    ) {
      return await interaction.reply({
        content: "❌ Bạn không có quyền duyệt.",
        ephemeral: true,
      });
    }

    await interaction.deferUpdate();

    const targetMsg = await interaction.channel.messages
      .fetch(messageId)
      .catch(() => null);
    if (!targetMsg) return;

    const originalContent =
      targetMsg.embeds[0]?.description || "Không rõ nội dung";

    // disable nút sau khi bấm
    const disabledRow = {
      type: 1,
      components: targetMsg.components[0].components.map((btn) => ({
        ...btn.data,
        disabled: true,
      })),
    };
    await targetMsg.edit({ components: [disabledRow] });

    if (action === "accept") {
      const publicChannel = await client.channels
        .fetch(config.publicChannel)
        .catch(() => null);
      if (!publicChannel) return;

      const embed = new EmbedBuilder()
        .setTitle("<a:AbbyPeak:1393909356625657876>**Confession Ẩn Danh**")
        .setDescription(originalContent)
        .setColor("Blue")
        .setFooter({ text: "Gửi bởi một ai đó trong máy chủ" })
        .setTimestamp();

      const sent = await publicChannel.send({ embeds: [embed] });
      const emojis = [
        "<a:AbbyPray:1393909359154696233>",
        "<a:AbbyShocked:1393909368138895411>",
        "<a:AbbyAngry:1393908721624551434>",
        "<a:AbbyExplain:1393909308554739732>",
        "<a:AbbyWOW:1393909383884439602>",
      ];
      for (const emoji of emojis) await sent.react(emoji);
    }
  }
});

// --- Bot ready ---
client.once("clientReady", () => {
  console.log(`🤖 Bot đã đăng nhập với tên ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "Iuno đến đâyyyy", type: 3 }],
    status: "idle",
  });
});

function streamFromUrl(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const stream = new Readable().wrap(res);
        resolve(stream);
      })
      .on("error", reject);
  });
}

// --- VoiceStateUpdate: đọc tên khi join ---
client.on("voiceStateUpdate", async (oldState, newState) => {
  // Khi có user mới vào voice
  if (
    !oldState.channelId &&
    newState.channelId &&
    newState.member &&
    !newState.member.user.bot
  ) {
    const member = newState.member;
    const channel = newState.channel;

    const text = `Chào mừng ${member.displayName} đã tham gia ${channel.name}!`;

    console.log(`🟢 ${member.displayName} vào voice: ${channel.name} | Bot đọc: ${text}`);

    const url = googleTTS.getAudioUrl(text, {
      lang: "vi",
      slow: false,
      host: "https://translate.google.com",
    });

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
    } catch {
      if (connection && !connection.destroyed) connection.destroy();
      return;
    }

    const audioStream = await streamFromUrl(url);
    const resource = createAudioResource(audioStream);
    const player = createAudioPlayer();

    connection.subscribe(player);
    player.play(resource);

    player.on(AudioPlayerStatus.Idle, () => {
      // Không destroy ở đây, để check voice trống xử lý
    });
  }

  // Nếu voice trống → bot rời
  if (oldState.channelId && !newState.channelId && oldState.channel) {
    const channel = oldState.channel;
    const remaining = channel.members.filter((m) => !m.user.bot);

    if (remaining.size === 0) {
      const botConnection = getVoiceConnection(channel.guild.id);
      if (botConnection && botConnection.state.status !== "destroyed") {
        botConnection.destroy();
        console.log("👋 Bot đã rời vì voice trống.");
      }
    }
  }
});

client.login(process.env.TOKEN);
