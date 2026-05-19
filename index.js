require('dotenv').config();
const { Client, Events, ChannelType, EmbedBuilder, GatewayIntentBits } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const tempCategories = new Map();

// ========================
// CREATE GAME HUB
// ========================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand()) return;
    
    if (interaction.commandName === 'createhub') {
        try {
            const { guild, member } = interaction;
            
            // CREATE CATEGORY
            const category = await guild.channels.create({
                name: 'Game Hub',
                type: ChannelType.GuildCategory,
            });

            // CREATE TEXT CHANNEL
            const textChannel = await guild.channels.create({
                name: 'team-chat',
                type: ChannelType.GuildText,
                parent: category.id,
            });

            // CREATE VOICE CHANNEL
            const voiceChannel = await guild.channels.create({
                name: 'Team Voice',
                type: ChannelType.GuildVoice,
                parent: category.id,
            });

            tempCategories.set(category.id, {
                ownerId: member.id,
                voiceId: voiceChannel.id,
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Game Hub Created')
                .setDescription(
                    `Category: ${category.name}\n` +
                    `Text Channel: ${textChannel.mention}\n` +
                    `Voice Channel: ${voiceChannel.mention}`
                )
                .setColor(0x57F287);

            await interaction.reply({
                embeds: [embed],
                ephemeral: true,
            });

        } catch (error) {
            console.error(error);

            await interaction.reply({
                content: 'Error creating the temporary hub.',
                ephemeral: true,
            });
        }
    }
});

// ========================
// AUTO CLEANUP
// ========================
client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    if (!oldState.guild) return;

    for (const [categoryId, data] of tempCategories.entries()) {
        const category = oldState.guild.channels.cache.get(categoryId);

        if (!category) {
            tempCategories.delete(categoryId);
            continue;
        }

        const voiceChannels = category.children.cache.filter(
            c => c.type === ChannelType.GuildVoice
        );

        const hasMembers = voiceChannels.some(vc => vc.members.size > 0);

        if (!hasMembers) {
            try {
                for (const channel of category.children.cache.values()) {
                    await channel.delete();
                }

                await category.delete();
                tempCategories.delete(categoryId);

                console.log(`Deleted empty category: ${category.name}`);

            } catch (err) {
                console.error(err);
            }
        }
    }
});

// ========================
// LOGIN
// ========================
client.login(process.env.TOKEN);
