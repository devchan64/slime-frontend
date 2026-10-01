import {executeWorkshopCommand} from './text-workshop-commands.mjs';
export function executeConsumableCommand(currentTextClient,currentCommandArguments){
 return executeWorkshopCommand(currentTextClient,['consumable',...currentCommandArguments]);
}
