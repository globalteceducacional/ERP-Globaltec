import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed do banco de dados...');

  // Criar permissões base
  const permissionsSeed = [
    { modulo: 'projetos', acao: 'visualizar', descricao: 'Visualizar projetos' },
    { modulo: 'projetos', acao: 'editar', descricao: 'Criar e editar projetos' },
    { modulo: 'projetos', acao: 'aprovar', descricao: 'Aprovar etapas e metas de projetos' },
    { modulo: 'trabalhos', acao: 'visualizar', descricao: 'Visualizar tarefas atribuídas' },
    { modulo: 'trabalhos', acao: 'registrar', descricao: 'Registrar progresso e anexos das tarefas' },
    { modulo: 'trabalhos', acao: 'avaliar', descricao: 'Avaliar entregas e aprovar objetivos' },
    { modulo: 'compras', acao: 'solicitar', descricao: 'Solicitar compras e orçamentos' },
    { modulo: 'compras', acao: 'aprovar', descricao: 'Aprovar solicitações de compras' },
    { modulo: 'estoque', acao: 'visualizar', descricao: 'Visualizar itens de estoque' },
    { modulo: 'estoque', acao: 'movimentar', descricao: 'Registrar movimentações de estoque' },
    { modulo: 'usuarios', acao: 'gerenciar', descricao: 'Gerenciar usuários e cargos' },
    { modulo: 'sistema', acao: 'administrar', descricao: 'Administrar configurações avançadas do sistema' },
  ];

  const permissionMap = new Map<string, number>();

  for (const permission of permissionsSeed) {
    const created = await prisma.permission.upsert({
      where: {
        modulo_acao: {
          modulo: permission.modulo,
          acao: permission.acao,
        },
      },
      create: permission,
      update: {
        descricao: permission.descricao,
      },
    });
    permissionMap.set(`${created.modulo}:${created.acao}`, created.id);
  }

  // Garantir que o mapa de permissões contenha TODAS as permissões existentes,
  // incluindo aquelas criadas manualmente ou por outras migrações
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    const key = `${perm.modulo}:${perm.acao}`;
    if (!permissionMap.has(key)) {
      permissionMap.set(key, perm.id);
    }
  }
  const allPermissionKeys = Array.from(
    new Set(allPermissions.map((p) => `${p.modulo}:${p.acao}`)),
  );

  // Configurações de cargos e permissões
  const cargosSeed = [
    {
      nome: 'EXECUTOR',
      descricao: 'Executor de tarefas',
      paginasPermitidas: ['/tasks/my', '/communications', '/notifications'],
      permissions: ['projetos:visualizar', 'trabalhos:visualizar', 'trabalhos:registrar'],
    },
    {
      nome: 'SUPERVISOR',
      descricao: 'Supervisor de projetos',
      paginasPermitidas: ['/tasks/my', '/communications', '/notifications'],
      permissions: [
        'projetos:visualizar',
        'projetos:editar',
        'projetos:aprovar',
        'trabalhos:visualizar',
        'trabalhos:registrar',
        'trabalhos:avaliar',
      ],
    },
    {
      nome: 'COTADOR',
      descricao: 'Responsável por cotações, estoque e curadoria',
      paginasPermitidas: ['/tasks/my', '/curadoria', '/stock', '/suppliers', '/categories', '/communications', '/notifications'],
      permissions: [
        'projetos:visualizar',
        'compras:solicitar',
        'compras:aprovar',
        'estoque:visualizar',
        'estoque:movimentar',
      ],
    },
    {
      nome: 'PAGADOR',
      descricao: 'Responsável por pagamentos e acompanhamento de compras',
      paginasPermitidas: ['/tasks/my', '/curadoria', '/stock', '/suppliers', '/categories', '/communications', '/notifications'],
      permissions: [
        'projetos:visualizar',
        'compras:aprovar',
        'estoque:visualizar',
      ],
    },
    {
      nome: 'DIRETOR',
      descricao: 'Diretor com acesso total ao sistema',
      paginasPermitidas: ['/dashboard', '/projects', '/tasks/my', '/curadoria', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos', '/notifications'],
      permissions: allPermissionKeys,
    },
    {
      nome: 'GM',
      descricao: 'Gerente Master com controle total do ERP',
      paginasPermitidas: ['/dashboard', '/projects', '/tasks/my', '/curadoria', '/stock', '/suppliers', '/categories', '/communications', '/users', '/cargos', '/notifications'],
      permissions: allPermissionKeys,
    },
  ];

  const cargosCriados = new Map<string, { id: number }>();

  for (const cargoSeed of cargosSeed) {
    const permissionIds = Array.from(cargoSeed.permissions, (key) => {
      const id = permissionMap.get(key);
      if (!id) {
        throw new Error(`Permissão não encontrada: ${key}`);
      }
      return id;
    });

    const cargo = await prisma.cargo.upsert({
      where: { nome: cargoSeed.nome },
      update: {
        descricao: cargoSeed.descricao,
        ativo: true,
        paginasPermitidas: cargoSeed.paginasPermitidas,
        permissions: {
          deleteMany: {},
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      create: {
        nome: cargoSeed.nome,
        descricao: cargoSeed.descricao,
        ativo: true,
        paginasPermitidas: cargoSeed.paginasPermitidas,
        permissions: {
          create: permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
    });

    cargosCriados.set(cargoSeed.nome, cargo);
  }

  const cargoExecutor = cargosCriados.get('EXECUTOR');
  const cargoSupervisor = cargosCriados.get('SUPERVISOR');
  const cargoDiretor = cargosCriados.get('DIRETOR');
  const cargoGerenteMaster = cargosCriados.get('GM');

  if (!cargoExecutor || !cargoSupervisor || !cargoDiretor || !cargoGerenteMaster) {
    throw new Error('Erro ao criar cargos base');
  }

  // Criar usuário administrador padrão
  const senhaHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@globaltec.com' },
    update: {},
    create: {
      nome: 'Administrador',
      email: 'admin@globaltec.com',
      senha: senhaHash,
      cargoId: cargoGerenteMaster.id,
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
      cargoId: cargoSupervisor.id,
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
      cargoId: cargoExecutor.id,
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
