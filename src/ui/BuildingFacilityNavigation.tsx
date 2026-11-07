import type {ComponentChildren} from 'preact';
import {useState} from 'preact/hooks';
import type {Client} from '../client/api';
import type {CityBuilding} from '../client/types';
import {useTranslation} from '../i18n';
import {NpcDialogue} from './NpcDialogue';
import {PartyFormationPanel} from './PartyFormationPanel';
import {GuildRecruitmentPanel} from './GuildRecruitmentPanel';
import {CitizenshipPricePanel} from './CitizenshipPricePanel';
import {GuildTradePanel} from './GuildTradePanel';
import {SkillCardPanel} from './SkillCardPanel';
import {WorkshopPanel} from './WorkshopPanel';
import './buildingFacilityNavigation.css';

type BuildingServiceEntry={serviceIdentifier:string;serviceLabel:string;serviceContent:ComponentChildren;serviceAvailable:boolean};
export function BuildingFacilityNavigation({currentBuildingDefinition,gameSessionClient,actionsAreDisabled,facilityInteractionAvailable,currentCharacterVersion}:{
  currentBuildingDefinition:CityBuilding;gameSessionClient:Client;actionsAreDisabled:boolean;facilityInteractionAvailable:boolean;currentCharacterVersion:number;
}){
  const {t:translateBuildingText}=useTranslation();
  const [selectedServiceIdentifier,setSelectedServiceIdentifier]=useState('');
  const [visitedServiceIdentifiers,setVisitedServiceIdentifiers]=useState<string[]>([]);
  const currentFacilityIdentifier=currentBuildingDefinition.facilityId;
  const sharedFacilityProperties={gameSessionClient,currentFacilityIdentifier:currentFacilityIdentifier!,actionsAreDisabled,embeddedPanelEnabled:true};
  const currentServiceEntries:BuildingServiceEntry[]=(currentBuildingDefinition.npcs??[]).map(currentBuildingNpc=>({
    serviceIdentifier:`npc:${currentBuildingNpc.id}`,serviceLabel:translateBuildingText('npc.talk',{name:currentBuildingNpc.name}),serviceAvailable:true,
    serviceContent:<NpcDialogue gameSessionClient={gameSessionClient} currentNpcIdentifier={currentBuildingNpc.id} currentNpcName={currentBuildingNpc.name}
      actionsAreDisabled={actionsAreDisabled} currentCharacterVersion={currentCharacterVersion} embeddedPanelEnabled/>,
  }));
  if(currentBuildingDefinition.facilityKind==='guild')currentServiceEntries.push(
    {serviceIdentifier:'formation',serviceLabel:translateBuildingText('city.formation'),serviceAvailable:true,serviceContent:<PartyFormationPanel {...sharedFacilityProperties}/>},
    {serviceIdentifier:'recruitment',serviceLabel:translateBuildingText('city.recruitment'),serviceAvailable:true,serviceContent:<GuildRecruitmentPanel {...sharedFacilityProperties}/>},
    {serviceIdentifier:'citizenship',serviceLabel:translateBuildingText('city.citizenship'),serviceAvailable:facilityInteractionAvailable,serviceContent:<CitizenshipPricePanel {...sharedFacilityProperties}/>},
    {serviceIdentifier:'trade',serviceLabel:translateBuildingText('city.materialSale'),serviceAvailable:facilityInteractionAvailable,serviceContent:<GuildTradePanel {...sharedFacilityProperties}/>},
  );
  if(currentBuildingDefinition.facilityKind==='bookshop')currentServiceEntries.push({serviceIdentifier:'cards',serviceLabel:translateBuildingText('cards.shop'),serviceAvailable:facilityInteractionAvailable,serviceContent:<SkillCardPanel {...sharedFacilityProperties}/>});
  if(currentBuildingDefinition.facilityKind==='workshop')currentServiceEntries.push({serviceIdentifier:'workshop',serviceLabel:translateBuildingText('city.workshopServices'),serviceAvailable:facilityInteractionAvailable,serviceContent:<WorkshopPanel {...sharedFacilityProperties}/>});
  const activeServiceIdentifier=selectedServiceIdentifier||currentServiceEntries[0]?.serviceIdentifier;
  if(!currentServiceEntries.length)return <p>{translateBuildingText('city.noServices')}</p>;
  return <div class={`building-facility-layout${currentServiceEntries.length===1?' has-single-service':''}`}>
    {currentServiceEntries.length>1&&<nav class="building-facility-navigation" aria-label={translateBuildingText('city.serviceNavigation')}>
      {currentServiceEntries.map(currentServiceEntry=><button key={currentServiceEntry.serviceIdentifier} class="secondary compact"
        aria-current={activeServiceIdentifier===currentServiceEntry.serviceIdentifier?'page':undefined}
        onClick={()=>{setVisitedServiceIdentifiers(currentVisitedServices=>Array.from(new Set([...currentVisitedServices,activeServiceIdentifier,currentServiceEntry.serviceIdentifier])));setSelectedServiceIdentifier(currentServiceEntry.serviceIdentifier);}}>
        {currentServiceEntry.serviceLabel}</button>)}
    </nav>}
    <div class="building-facility-content">
      {currentServiceEntries.map(currentServiceEntry=><section key={currentServiceEntry.serviceIdentifier} hidden={activeServiceIdentifier!==currentServiceEntry.serviceIdentifier}
        aria-label={currentServiceEntry.serviceLabel}>
        {/* 방문한 기능은 유지하여 처리 중 요청과 결과 확인 정보를 잃지 않는다. */}
        {(activeServiceIdentifier===currentServiceEntry.serviceIdentifier||visitedServiceIdentifiers.includes(currentServiceEntry.serviceIdentifier))&&
          (currentServiceEntry.serviceAvailable?currentServiceEntry.serviceContent:<p role="status">{translateBuildingText('city.serviceUnavailable')}</p>)}
      </section>)}
    </div>
  </div>;
}
