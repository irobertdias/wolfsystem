'use client';
import { Suspense } from 'react';
import AtendimentoShell from './AtendimentoShell';
export default function Chatbot() { return <Suspense fallback={<p>Carregando atendimento…</p>}><AtendimentoShell /></Suspense>; }
