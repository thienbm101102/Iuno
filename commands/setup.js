import { SlashCommandBuilder, ChannelType } from 'discord.js';
import fs from 'fs';

export default {
  data: new SlashCommandBuilder()
    .setName('confession')
    .setDescription('Thiết lập kênh confession')
    .addSubcommand(sub =>
      sub.setName('setup')
        .setDescription('Thiết lập kênh duyệt và kênh công khai')
        .addChannelOption(option =>
          option.setName('duyet')
            .setDescription('Kênh để duyệt confession')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
        .addChannelOption(option =>
          option.setName('cong_khai')
            .setDescription('Kênh sẽ đăng confession sau khi duyệt')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    ),
  async execute(interaction) {
    const duyet = interaction.options.getChannel('duyet');
    const congKhai = interaction.options.getChannel('cong_khai');

    const config = {
      reviewChannel: duyet.id,
      publicChannel: congKhai.id
    };
    fs.writeFileSync('./config.json', JSON.stringify(config, null, 2));
    await interaction.reply({ content: '✅ Đã thiết lập thành công kênh duyệt và kênh đăng.', ephemeral: true });
  }
};
