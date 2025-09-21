import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fs from 'fs';

export default {
  data: new SlashCommandBuilder()
    .setName('confess')
    .setDescription('Gửi một confession ẩn danh')
    .addStringOption(option =>
      option.setName('nội_dung')
        .setDescription('Nhập nội dung bạn muốn gửi')
        .setRequired(true)
    ),
  async execute(interaction, client) {
    const content = interaction.options.getString('nội_dung');
    const raw = fs.readFileSync('./config.json', 'utf8');
    const config = JSON.parse(raw);
    const reviewChannel = await client.channels.fetch(config.reviewChannel).catch(() => null);
    if (!reviewChannel) return interaction.reply({ content: '⚠️ Chưa thiết lập kênh duyệt.', ephemeral: true });

    const embed = new EmbedBuilder()
      .setTitle('📝 Confession chờ duyệt')
      .setDescription(content)
      .setColor('Yellow')
      .setFooter({ text: `Sender: ${interaction.user.id}` })
      .setTimestamp();

    const row = {
      type: 1,
      components: [
        {
          type: 2,
          label: '✅ Duyệt',
          style: 3,
          custom_id: `accept_`,
        },
        {
          type: 2,
          label: '❌ Từ chối',
          style: 4,
          custom_id: `reject_`,
        }
      ]
    };

    const sent = await reviewChannel.send({ embeds: [embed], components: [row] });
    row.components[0].custom_id += sent.id;
    row.components[1].custom_id += sent.id;
    await sent.edit({ components: [row] });

    await interaction.reply({ content: '📬 Confession của bạn đã được gửi để chờ duyệt!', ephemeral: true });
  },
  
// xử lý nút bấm duyệt / từ chối
  async handleButtons(interaction, client) {
    if (!interaction.isButton()) return;
    if (!interaction.customId.startsWith("accept_") && !interaction.customId.startsWith("reject_")) return;

    const message = interaction.message;
    const confessionEmbed = message.embeds[0];

    // Disable 2 nút sau khi bấm
    const disabledRow = {
      type: 1,
      components: message.components[0].components.map(btn => ({
        ...btn.data,
        disabled: true
      }))
    };
    await message.edit({ components: [disabledRow] });

    // Lấy config
    const raw = fs.readFileSync('./config.json', 'utf8');
    const config = JSON.parse(raw);

    if (interaction.customId.startsWith("accept_")) {
}
 }
};
