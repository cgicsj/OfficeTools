import { app } from 'electron';

if (!app.isPackaged) {
  app.setPath('userData', `${app.getPath('userData')}-dev`);
}

