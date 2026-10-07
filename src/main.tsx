import React from 'react';
import {hydrateRoot} from 'react-dom/client';
import PortfolioView from './portfolio';
import content from '../content.json';
import './style.css';
hydrateRoot(document.getElementById('root')!,<PortfolioView data={content}/>);
