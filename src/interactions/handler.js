import { MessageFlags } from 'discord.js';
import { commandMap } from '../commands/index.js';
import { logger } from '../utils/logger.js';
import { handleButton } from './buttons.js';

async function replyWithFailure(interaction) {
  const content = 'Something went wrong. Please try again later.';
  try {
    if (interaction.isChatInputCommand?.() && interaction.deferred && !interaction.replied) {
      await interaction.editReply({ content, embeds: [], components: [] });
    } else if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content, flags: MessageFlags.Ephemeral });
    } else {
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    logger.error('Could not report failure to user', err);
  }
}

export function createInteractionHandler(ctx) {
  return async function onInteraction(interaction) {
    try {
      if (interaction.isChatInputCommand()) {
        const command = commandMap.get(interaction.commandName);
        if (command) await command.execute(interaction, ctx);
      } else if (interaction.isButton()) {
        await handleButton(interaction, ctx);
      }
    } catch (err) {
      logger.error(`Interaction failed (${interaction.commandName ?? interaction.customId})`, err);
      await replyWithFailure(interaction);
    }
  };
}
