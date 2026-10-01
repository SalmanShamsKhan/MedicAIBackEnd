import axios from 'axios';
import { createPredictHandler } from '../inference.cjs';

export const predictImage = createPredictHandler({
  request: axios,
  url: process.env.AWS_INFERENCE_URL,
});
