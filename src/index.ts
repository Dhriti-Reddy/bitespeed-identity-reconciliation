import dotenv from 'dotenv';
dotenv.config();
import express from "express";
import type { Request, Response } from "express";
import { PrismaClient } from '@prisma/client';

// 1. Define the Contact interface so TypeScript understands the database rows [cite: 16, 24]
interface Contact {
    id: number;
    phoneNumber: string | null;
    email: string | null;
    linkedId: number | null;
    linkPrecedence: "primary" | "secondary";
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
}

const app = express();
const prisma = new PrismaClient();

app.use(express.json());

app.post('/identify', async (req: Request, res: Response) => {
    const { email, phoneNumber } = req.body;

    // Validation: Ensure at least one contact method is provided [cite: 15, 37]
    if (!email && !phoneNumber) {
        return res.status(400).json({ error: "Email or phoneNumber required" });
    }

    try {
        const phoneStr = phoneNumber?.toString() || null;

        // 2. Search for existing contacts [cite: 27]
        const matchedContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { email: email || undefined },
                    { phoneNumber: phoneStr || undefined }
                ]
            }
        }) as unknown as Contact[];

        // SCENARIO A: No existing contacts - Create new primary [cite: 88, 89]
        if (matchedContacts.length === 0) {
            const newPrimary = await prisma.contact.create({
                data: { email, phoneNumber: phoneStr, linkPrecedence: "primary" }
            }) as unknown as Contact;
            return res.status(200).json(formatResponse(newPrimary, []));
        }

        // 3. Find all related contacts to identify the true "Primary" [cite: 25, 26]
        const allLinkedIds = matchedContacts.map(c => c.linkedId || c.id);
        
        const allRelated = await prisma.contact.findMany({
            where: {
                OR: [
                    { id: { in: allLinkedIds } },
                    { linkedId: { in: allLinkedIds } },
                    { id: { in: matchedContacts.map(m => m.id) } }
                ]
            }
        }) as unknown as Contact[];

        // Sort by date: The oldest record is always the primary [cite: 26, 31]
        const sorted = allRelated.sort((a: Contact, b: Contact) => a.createdAt.getTime() - b.createdAt.getTime());
        const primaryContact = sorted.find(c => c.linkPrecedence === "primary") || sorted[0];

        // SCENARIO B: Existing contact found, but with new information [cite: 90, 91]
        const isNewEmail = email && !allRelated.some(c => c.email === email);
        const isNewPhone = phoneStr && !allRelated.some(c => c.phoneNumber === phoneStr);

        if (isNewEmail || isNewPhone) {
            await prisma.contact.create({
                data: {
                    email,
                    phoneNumber: phoneStr,
                    linkedId: primaryContact.id,
                    linkPrecedence: "secondary"
                }
            });
        }

        // SCENARIO C: Linking two primary contacts [cite: 144, 145]
        // If an incoming request links two primary families, convert the newer primary to secondary
        const otherPrimaries = allRelated.filter(c => c.linkPrecedence === "primary" && c.id !== primaryContact.id);
        for (const p of otherPrimaries) {
            await prisma.contact.update({
                where: { id: p.id },
                data: { linkPrecedence: "secondary", linkedId: primaryContact.id }
            });
        }

        // 4. Final fetch to gather all linked info for the response [cite: 43]
        const finalContacts = await prisma.contact.findMany({
            where: {
                OR: [
                    { id: primaryContact.id },
                    { linkedId: primaryContact.id }
                ]
            }
        }) as unknown as Contact[];

        return res.status(200).json(formatResponse(primaryContact, finalContacts));

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Helper to format JSON response exactly as required [cite: 45, 56, 65]
function formatResponse(primary: Contact, all: Contact[]) {
    const emails = Array.from(new Set([primary.email, ...all.map((c: Contact) => c.email)])).filter(Boolean);
    const phoneNumbers = Array.from(new Set([primary.phoneNumber, ...all.map((c: Contact) => c.phoneNumber)])).filter(Boolean);
    const secondaryIds = all.filter((c: Contact) => c.id !== primary.id).map((c: Contact) => c.id);

    return {
        contact: {
            primaryContatctId: primary.id, // Primary contact ID [cite: 47, 67]
            emails, // Array of emails starting with primary [cite: 48, 68]
            phoneNumbers, // Array of phone numbers starting with primary [cite: 50, 70]
            secondaryContactIds: secondaryIds // List of all secondary IDs [cite: 54, 71]
        }
    };
}

const PORT = 3000;
app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));