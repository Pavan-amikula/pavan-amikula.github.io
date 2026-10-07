import React from 'react';
import {renderToString} from 'react-dom/server';
import PortfolioView from './portfolio';
import content from '../content.json';
export function render(){return renderToString(<PortfolioView data={content}/>);}
