/**
 * Email service for sending notifications via Firebase Extensions
 * Queues emails in Firestore for the Trigger Email extension to process
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';

// ============================================================================
// EMAIL QUEUE
// ============================================================================

const EMAIL_QUEUE_COLLECTION = 'emailQueue';

interface EmailMessage {
  subject: string;
  text?: string;
  html?: string;
}

interface EmailDocument {
  to: string;
  message: EmailMessage;
  template?: {
    name: string;
    data: Record<string, string>;
  };
  delivery?: {
    state: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'ERROR';
    startTime?: Date;
    endTime?: Date;
    error?: string;
    attempts?: number;
    leaseExpireTime?: Date;
  };
}

/**
 * Queue an email to be sent
 */
export async function queueEmail(
  firestore: Firestore,
  to: string,
  message: EmailMessage,
  template?: EmailDocument['template']
): Promise<string> {
  const emailDoc: EmailDocument = {
    to,
    message,
    template,
    delivery: {
      state: 'PENDING',
      attempts: 0,
    },
  };

  const docRef = await addDoc(collection(firestore, EMAIL_QUEUE_COLLECTION), emailDoc);
  return docRef.id;
}

// ============================================================================
// PROJECT INVITE EMAIL
// ============================================================================

interface ProjectInviteEmailData {
  to: string;
  projectName: string;
  invitedByName: string;
  inviteLink: string;
  role: string;
}

export async function sendProjectInviteEmail(
  firestore: Firestore,
  data: ProjectInviteEmailData
): Promise<string> {
  const { to, projectName, invitedByName, inviteLink, role } = data;

  const roleText = {
    editor: 'Editor (pode editar documentos e convidar membros)',
    viewer: 'Visualizador (acesso somente leitura)',
  }[role] || role;

  return queueEmail(
    firestore,
    to,
    {
      subject: `Convite para colaborar em "${projectName}"`,
      text: `Olá!

${invitedByName} convidou você para colaborar no projeto "${projectName}" no Assistente de Contratos V-Lab.

Permissão: ${roleText}

Para aceitar o convite, acesse:
${inviteLink}

Este convite expira em 7 dias.

---
Assistente de Contratos V-Lab`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Convite para colaborar</h2>
          
          <p>Olá!</p>
          
          <p><strong>${invitedByName}</strong> convidou você para colaborar no projeto <strong>"${projectName}"</strong> no Assistente de Contratos V-Lab.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Sua permissão:</strong> ${roleText}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${inviteLink}" 
               style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Aceitar Convite
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Ou copie e cole este link no seu navegador:<br>
            <a href="${inviteLink}" style="color: #007bff;">${inviteLink}</a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          
          <p style="color: #999; font-size: 12px;">
            Este convite expira em 7 dias. Se você não esperava este convite, pode ignorar este email.
          </p>
        </div>
      `,
    },
    {
      name: 'project_invite',
      data: {
        projectName,
        invitedByName,
        inviteLink,
        role: roleText,
      },
    }
  );
}

// ============================================================================
// ROLE CHANGE EMAIL
// ============================================================================

interface RoleChangeEmailData {
  to: string;
  projectName: string;
  changedByName: string;
  newRole: string;
  projectLink: string;
}

export async function sendRoleChangeEmail(
  firestore: Firestore,
  data: RoleChangeEmailData
): Promise<string> {
  const { to, projectName, changedByName, newRole, projectLink } = data;

  const roleText = {
    owner: 'Proprietário',
    editor: 'Editor',
    viewer: 'Visualizador',
  }[newRole] || newRole;

  return queueEmail(
    firestore,
    to,
    {
      subject: `Sua permissão em "${projectName}" foi atualizada`,
      text: `Olá!

${changedByName} atualizou sua permissão no projeto "${projectName}".

Nova permissão: ${roleText}

Acesse o projeto:
${projectLink}

---
Assistente de Contratos V-Lab`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Permissão atualizada</h2>
          
          <p>Olá!</p>
          
          <p><strong>${changedByName}</strong> atualizou sua permissão no projeto <strong>"${projectName}"</strong>.</p>
          
          <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Sua nova permissão:</strong> ${roleText}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${projectLink}" 
               style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Acessar Projeto
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        </div>
      `,
    }
  );
}

// ============================================================================
// ACTIVITY NOTIFICATION EMAIL
// ============================================================================

interface ActivityNotificationEmailData {
  to: string;
  projectName: string;
  activityDescription: string;
  actorName: string;
  projectLink: string;
}

export async function sendActivityNotificationEmail(
  firestore: Firestore,
  data: ActivityNotificationEmailData
): Promise<string> {
  const { to, projectName, activityDescription, actorName, projectLink } = data;

  return queueEmail(
    firestore,
    to,
    {
      subject: `Nova atividade em "${projectName}"`,
      text: `Olá!

${actorName} ${activityDescription} no projeto "${projectName}".

Acesse o projeto:
${projectLink}

---
Assistente de Contratos V-Lab`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Nova atividade</h2>
          
          <p>Olá!</p>
          
          <p><strong>${actorName}</strong> ${activityDescription} no projeto <strong>"${projectName}"</strong>.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${projectLink}" 
               style="background: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Ver Atividade
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
        </div>
      `,
    }
  );
}
