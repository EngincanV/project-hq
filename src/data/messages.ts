// Labels for the data enums (shared by every feature) and the starter files of a new project.
import { defineMessages } from '../i18n';
import type { ProjectStatus, ProjectType, StoreStatus } from './types';

interface DataMessages {
  projectType: Record<ProjectType, string>;
  projectStatus: Record<ProjectStatus, string>;
  storeStatus: Record<StoreStatus, string>;
  starter: {
    roadmapTitle: string;
    columns: [string, string, string];
    firstItem: string;
    welcomeFile: string;
    welcomeNote: (projectName: string) => string;
  };
}

export const dataMessages = defineMessages<DataMessages>({
  tr: {
    projectType: {
      'mobile-game': 'Mobil oyun',
      'mobile-app': 'Mobil uygulama',
      'web-app': 'Web uygulaması',
      saas: 'SaaS',
      other: 'Diğer',
    },
    projectStatus: {
      idea: 'Fikir',
      building: 'Geliştiriliyor',
      live: 'Yayında',
      paused: 'Beklemede',
      archived: 'Arşivlendi',
    },
    storeStatus: {
      'not-started': 'Başlanmadı',
      draft: 'Taslak',
      'internal-testing': 'Dahili test',
      'closed-testing': 'Kapalı test',
      'open-testing': 'Açık test',
      'in-review': 'İncelemede',
      live: 'Yayında',
      rejected: 'Reddedildi',
    },
    starter: {
      roadmapTitle: 'Yol haritası',
      columns: ['Şimdi', 'Sırada', 'Sonra'],
      firstItem: 'İlk yol haritası maddeni ekle',
      welcomeFile: 'hos-geldin',
      welcomeNote: (name) =>
        `# Hoş geldin\n\n${name} için notlarını buraya yazabilirsin. Yeni notlar Notlar sekmesinden eklenir.\n`,
    },
  },
  en: {
    projectType: {
      'mobile-game': 'Mobile game',
      'mobile-app': 'Mobile app',
      'web-app': 'Web app',
      saas: 'SaaS',
      other: 'Other',
    },
    projectStatus: {
      idea: 'Idea',
      building: 'Building',
      live: 'Live',
      paused: 'Paused',
      archived: 'Archived',
    },
    storeStatus: {
      'not-started': 'Not started',
      draft: 'Draft',
      'internal-testing': 'Internal testing',
      'closed-testing': 'Closed testing',
      'open-testing': 'Open testing',
      'in-review': 'In review',
      live: 'Live',
      rejected: 'Rejected',
    },
    starter: {
      roadmapTitle: 'Roadmap',
      columns: ['Now', 'Next', 'Later'],
      firstItem: 'Add your first roadmap item',
      welcomeFile: 'welcome',
      welcomeNote: (name) =>
        `# Welcome\n\nWrite your notes for ${name} here. Add more notes from the Notes tab.\n`,
    },
  },
});
