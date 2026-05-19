require('dotenv').config();
const { Client, Events, ChannelType, EmbedBuilder, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
const tempCategories = new Map();

// ========================
// SEND PANEL WITH BUTTONS
// ========================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isCommand()) return;
    
    if (interaction.commandName === 'gamepanel') {
        try {
            const { member } = interaction;

            // Check if user is admin
            if (!member.permissions.has('Administrator')) {
                return await interaction.reply({
                    content: '❌ You must be an administrator to use this command.',
                    ephemeral: true,
                });
            }

            // Create buttons for different games
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('create_hub_fc')
                        .setLabel('⚽ FC Pro Club')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('create_hub_cod')
                        .setLabel('🎮 Call of Duty')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('create_hub_gta')
                        .setLabel('🚗 GTA')
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId('create_hub_custom')
                        .setLabel('⚙️ Custom Game')
                        .setStyle(ButtonStyle.Secondary)
                );

            const embed = new EmbedBuilder()
                .setTitle('🎮 Game Hub Panel')
                .setDescription('Click a button below to create a temporary game category!')
                .setColor(0x5865F2)
                .addFields(
                    { name: '⚽ FC Pro Club', value: 'Create a hub for FC Pro Club sessions', inline: true },
                    { name: '🎮 Call of Duty', value: 'Create a hub for CoD gameplay', inline: true },
                    { name: '🚗 GTA', value: 'Create a hub for GTA sessions', inline: true },
                    { name: '⚙️ Custom Game', value: 'Create a hub with custom name', inline: true }
                );

            await interaction.reply({
                embeds: [embed],
                components: [row],
                ephemeral: true,
            });

        } catch (error) {
            console.error(error);

            await interaction.reply({
                content: '❌ Error creating the game panel.',
                ephemeral: true,
            });
        }
    }
});

// ========================
// BUTTON INTERACTIONS
// ========================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    const { customId, member, guild, showModal } = interaction;

    // Check if user is admin
    if (!member.permissions.has('Administrator')) {
        return await interaction.reply({
            content: '❌ You must be an administrator to create hubs.',
            ephemeral: true,
        });
    }

    if (customId === 'create_hub_custom') {
        // Show modal for custom name
        const modal = new ModalBuilder()
            .setCustomId('game_hub_modal')
            .setTitle('Create Custom Game Hub');

        const categoryNameInput = new TextInputBuilder()
            .setCustomId('category_name')
            .setLabel('Category Name')
            .setPlaceholder('Enter the game or category name...')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(categoryNameInput);
        modal.addComponents(row);

        await showModal(modal);
    } else if (customId.startsWith('create_hub_')) {
        // Handle predefined game hubs
        const gameType = customId.replace('create_hub_', '');
        const gameNames = {
            fc: '⚽ FC Pro Club',
            cod: '🎮 Call of Duty',
            gta: '🚗 GTA',
        };

        const categoryName = gameNames[gameType] || 'Game Hub';
        await createGameHub(interaction, guild, member, categoryName);
    }
});

// ========================
// MODAL SUBMISSION
// ========================
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId === 'game_hub_modal') {
        try {
            const categoryName = interaction.fields.getTextInputValue('category_name');
            await createGameHub(interaction, interaction.guild, interaction.member, categoryName);
        } catch (error) {
            console.error(error);

            await interaction.reply({
                content: '❌ Error creating the custom hub.',
                ephemeral: true,
            });
        }
    }
});

// ========================
// CREATE GAME HUB FUNCTION
// ========================
async function createGameHub(interaction, guild, member, categoryName) {
    try {
        await interaction.deferReply({ ephemeral: true });

        // CREATE CATEGORY
        const category = await guild.channels.create({
            name: categoryName,
            type: ChannelType.GuildCategory,
        });

        // CREATE TEXT CHANNEL
        const textChannel = await guild.channels.create({
            name: 'team-chat',
            type: ChannelType.GuildText,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory'],
                },
            ],
        });

        // CREATE VOICE CHANNEL
        const voiceChannel = await guild.channels.create({
            name: 'Team Voice',
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: [
                {
                    id: guild.id,
                    allow: ['ViewChannel', 'Connect', 'Speak'],
                },
            ],
        });

        tempCategories.set(category.id, {
            ownerId: member.id,
            voiceId: voiceChannel.id,
            createdAt: Date.now(),
        });

        const embed = new EmbedBuilder()
            .setTitle('✅ Game Hub Created')
            .setDescription(
                `**Game:** ${categoryName}\n` +
                `**Category:** ${category.name}\n` +
                `**Text Channel:** ${textChannel.mention}\n` +
                `**Voice Channel:** ${voiceChannel.mention}\n\n` +
                `*Hub will auto-delete when empty*`
            )
            .setColor(0x57F287)
            .setFooter({ text: `Created by ${member.user.username}` })
            .setTimestamp();

        await interaction.editReply({
            embeds: [embed],
        });

        console.log(`[${new Date().toLocaleTimeString()}] Created hub "${categoryName}" by ${member.user.tag}`);

    } catch (error) {
        console.error(error);

        await interaction.editReply({
            content: '❌ Error creating the temporary hub. Make sure the bot has proper permissions.',
        });
    }
}

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

                console.log(`[${new Date().toLocaleTimeString()}] Deleted empty category: ${category.name}`);

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
