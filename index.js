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
  VoiceConnectionStatus,
  getVoiceConnection,
} from "@discordjs/voice";
import googleTTS from "google-tts-api";

dotenv.config();

const app = express();

app.get("/", (req, res) => {
  res.set("Content-Type", "text/plain"); 
  res.status(200).send("OK - Bot Iuno dang hoat dong");
});

app.listen(process.env.PORT || 10000, () => {
  console.log(`🌐 Web server Iuno running at ${process.env.PORT || 10000}`);
});

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

// An toàn khi nạp lệnh: Bỏ qua lỗi nếu thư mục commands không tồn tại
client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  try {
    const commandFiles = fs
      .readdirSync(commandsPath)
      .filter((file) => file.endsWith(".js"));

    for (const file of commandFiles) {
      const command = await import(`./commands/${file}`);
      client.commands.set(command.default.data.name, command.default);
    }
  } catch (error) {
    console.log("⚠️ Bỏ qua nạp commands vì thư mục trống hoặc có lỗi.");
  }
}

// Xử lý nút bấm Confession
client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    const command = client.commands.get(interaction.commandName);
    if (command) await command.execute(interaction, client);
  } else if (interaction.isButton()) {
    const [action, messageId] = interaction.customId.split("_");
    const configPath = path.join(__dirname, "config.json");
    
    if (!fs.existsSync(configPath)) return interaction.reply({ content: "❌ Thiếu file config.json", ephemeral: true });
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

    if (!interaction.memberPermissions.has(PermissionsBitField.Flags.ManageMessages)) {
      return await interaction.reply({ content: "❌ Bạn không có quyền duyệt.", ephemeral: true });
    }

    await interaction.deferUpdate();

    const targetMsg = await interaction.channel.messages.fetch(messageId).catch(() => null);
    if (!targetMsg) return;

    const originalContent = targetMsg.embeds[0]?.description || "Không rõ nội dung";

    const disabledRow = {
      type: 1,
      components: targetMsg.components[0].components.map((btn) => ({
        ...btn.data,
        disabled: true,
      })),
    };
    await targetMsg.edit({ components: [disabledRow] });

    if (action === "accept") {
      const publicChannel = await client.channels.fetch(config.publicChannel).catch(() => null);
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

// Sự kiện báo bot đã Online trên Discord
client.once("ready", () => {
  console.log(`🤖 Bot đã đăng nhập thành công với tên ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "Iuno đến đâyyyy", type: 3 }],
    status: "online",
  });
});

// Xử lý âm thanh (Voice) bằng file cứng Base64
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && newState.member && !newState.member.user.bot) {
    const member = newState.member;
    const channel = newState.channel;

    const text = `Chào mừng ${member.displayName} đã tham gia ${channel.name}!`;
    console.log(`🟢 ${member.displayName} vào voice: ${channel.name} | Bot đọc: ${text}`);

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true, 
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch {
      console.error("⚠️ Timeout kết nối Voice. Vẫn ép phát...");
    }

    try {
      const base64Audio = await googleTTS.getAudioBase64(text, {
        lang: "vi",
        slow: false,
        host: "https://translate.google.com",
      });

      const tempFileName = `join-${Date.now()}.mp3`;
      const tempFilePath = path.join(__dirname, tempFileName);
      fs.writeFileSync(tempFilePath, Buffer.from(base64Audio, "base64"));

      const resource = createAudioResource(tempFilePath);
      const player = createAudioPlayer();

      connection.subscribe(player);
      player.play(resource);

      setTimeout(() => {
        try {
          if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
        } catch (err) {}
      }, 20000);

    } catch (err) {
      console.error("❌ Lỗi tải âm thanh Base64:", err.message);
    }
  }

  if (oldState.channelId && !newState.channelId && oldState.channel) {
    const channel = oldState.channel;
    const remaining = channel.members.filter((m) => !m.user.bot);

    if (remaining.size === 0) {
      const botConnection = getVoiceConnection(channel.guild.id);
      if (botConnection && botConnection.state.status !== "destroyed") {
        try {
          botConnection.destroy();
          console.log("👋 Bot đã rời vì voice trống.");
        } catch (e) {}
      }
    }
  }
});

// TRẠM KIỂM SOÁT TOKEN VÀ ĐĂNG NHẬP CUỐI CÙNG
console.log("🔑 Đang tiến hành đăng nhập vào Discord...");
if (!process.env.TOKEN) {
  console.error("❌ LỖI NGHIÊM TRỌNG: BIẾN TOKEN BỊ TRỐNG! Bạn chưa nhập TOKEN trên Render.");
} else {
  client.login(process.env.TOKEN).catch(err => {
    console.error("❌ LỖI ĐĂNG NHẬP DISCORD (Sai Token hoặc kẹt mạng):", err.message);
  });
}
