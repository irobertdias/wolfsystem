export const runtime='nodejs';
export const dynamic='force-dynamic';
import { NextRequest } from 'next/server';
import { consultar } from './_consulta';
export function GET(request:NextRequest){return consultar(request);}
