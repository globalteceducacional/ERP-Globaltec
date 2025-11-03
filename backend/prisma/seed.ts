import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar usuário administrador padrão
  const senhaHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@globaltec.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@globaltec.com',
      senha: senhaHash,
      cargo: 'DIRETOR',
      ativo: true,
    },
  });

  console.log('✅ Usuário administrador criado:', admin.email);

  // Criar usuários de exemplo
  const supervisor = await prisma.usuario.upsert({
    where: { email: 'supervisor@globaltec.com' },
    update: {},
    create: {
      nome: 'Supervisor Exemplo',
      email: 'supervisor@globaltec.com',
      senha: await bcrypt.hash('senha123', 10),
      cargo: 'SUPERVISOR',
      ativo: true,
    },
  });

  const executor = await prisma.usuario.upsert({
    where: { email: 'executor@globaltec.com' },
    update: {},
    create: {
      nome: 'Executor Exemplo',
      email: 'executor@globaltec.com',
      senha: await bcrypt.hash('senha123', 10),
      cargo: 'EXECUTOR',
      ativo: true,
    },
  });

  console.log('✅ Usuários de exemplo criados');

  // Criar projeto de exemplo
  const projeto = await prisma.projeto.create({
    data: {
      nome: 'Projeto Exemplo',
      resumo: 'Este é um projeto de exemplo para testes',
      objetivo: 'Demonstrar funcionalidades do sistema',
      valorTotal: 50000,
      valorInsumos: 15000,
      supervisorId: supervisor.id,
      responsaveis: {
        create: [{ usuarioId: supervisor.id }, { usuarioId: executor.id }],
      },
    },
  });

  console.log('✅ Projeto de exemplo criado:', projeto.nome);

  // Criar etapa de exemplo
  const etapa = await prisma.etapa.create({
    data: {
      nome: 'Desenvolvimento Inicial',
      descricao: 'Primeira etapa do projeto exemplo',
      projetoId: projeto.id,
      executorId: executor.id,
      status: 'PENDENTE',
      valorInsumos: 5000,
    },
  });

  console.log('✅ Etapa de exemplo criada:', etapa.nome);

  // Criar notificação de exemplo
  await prisma.notificacao.create({
    data: {
      titulo: 'Bem-vindo ao ERP Globaltec!',
      mensagem: 'Sistema inicializado com sucesso. Comece criando seus projetos!',
      tipo: 'SUCCESS',
      usuarioId: admin.id,
    },
  });

  console.log('✅ Notificação de exemplo criada');

  console.log('\n🎉 Seed concluído com sucesso!');
  console.log('\n📋 Credenciais de acesso:');
  console.log('   Administrador: admin@globaltec.com / admin123');
  console.log('   Supervisor: supervisor@globaltec.com / senha123');
  console.log('   Executor: executor@globaltec.com / senha123');
}

main()
  .catch((e) => {
    console.error('❌ Erro ao executar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

