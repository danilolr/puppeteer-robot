import { Routes } from '@angular/router';
import { MainTemplate } from './template/main-template/main-template';
import { StartPage } from './page/start-page/start-page';
import { AboutPage } from './page/about-page/about-page';
import { SendCommandPage } from './page/send-command-page/send-command-page';

export const routes: Routes = [
    {
        path: '',
        component: MainTemplate,
        children: [
            {
                path: '',
                component: StartPage,
            },
            {
                path: 'about',
                component: AboutPage,
            },
            {
                path: 'command',
                component: SendCommandPage,
            }
        ]
    }
]
