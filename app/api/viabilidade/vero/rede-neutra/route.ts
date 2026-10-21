import { NextRequest } from 'next/server';
import { consultar } from '../_consulta';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export function GET(request:NextRequest){return consultar(request,'neutra');}
