
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, CheckCircle2, Wand2, Loader2, Sparkles, RefreshCw } from "lucide-react";
import { type Template } from "@/lib/types";
import { matchEntitiesToPlaceholders } from "@/ai/flows/match-entities-to-placeholders";

interface EntityEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (entities: Record<string, any>) => void;
    selectedTemplates: (Template & { id: string })[];
    extractedEntities: Record<string, any>;
    entityDescriptions?: Record<string, string>;
}

export function EntityEditModal({
    isOpen,
    onClose,
    onConfirm,
    selectedTemplates,
    extractedEntities,
    entityDescriptions,
}: EntityEditModalProps) {
    const [editableEntities, setEditableEntities] = useState<Record<string, string>>({});
    const [isMatching, setIsMatching] = useState(false);
    const [matchedByAI, setMatchedByAI] = useState<Set<string>>(new Set());

    const requiredPlaceholders = useMemo(() => {
        const placeholdersSet = new Set<string>();
        // Lista de tags HTML comuns para ignorar
        const BLOCKED_TAGS = new Set([
            'P', 'BR', 'STRONG', 'EM', 'U', 'UL', 'OL', 'LI', 'DIV', 'SPAN',
            'TABLE', 'TR', 'TD', 'TH', 'THEAD', 'TBODY',
            'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HR',
            'A', 'IMG', 'IFRAME', 'SCRIPT', 'STYLE', 'LINK', 'META', 'HEAD', 'BODY', 'HTML'
        ]);

        selectedTemplates.forEach(template => {
            if (template.markdownContent) {
                const matches = template.markdownContent.match(/{{(.*?)}}|<(.*?)>/g) || [];
                matches.forEach(match => {
                    const key = match.replace(/{{|}}|<|>/g, '').trim().toUpperCase();
                    // Ignora chaves vazias, tags de fechamento (começam com /) e tags HTML conhecidas
                    if (key && !key.startsWith('/') && !BLOCKED_TAGS.has(key) && !key.startsWith('!DOCTYPE')) {
                        // Também ignora se parecer uma abertura de tag com atributos (ex: "DIV CLASS=...")
                        // Assumindo que placeholders reais não costumam ter "=" (a menos que seja um valor default, mas por segurança vamos filtrar o padrão de tag HTML)
                        const firstWord = key.split(' ')[0];
                        if (!BLOCKED_TAGS.has(firstWord)) {
                            placeholdersSet.add(key);
                        }
                    }
                });
            }
        });

        return Array.from(placeholdersSet).sort();
    }, [selectedTemplates]);

    const normalizeKey = (key: string) => key.toUpperCase().replace(/[\s_]+/g, '_').trim();

    const performMatching = useCallback(async () => {
        setIsMatching(true);
        const initialEntities: Record<string, string> = {};
        const aiMatched = new Set<string>();

        try {
            const normalizedExtracted = Object.entries(extractedEntities).reduce((acc, [key, value]) => {
                acc[normalizeKey(key)] = String(value);
                return acc;
            }, {} as Record<string, string>);

            const unmatchedPlaceholders: string[] = [];

            requiredPlaceholders.forEach(placeholder => {
                const normPlaceholder = normalizeKey(placeholder);
                if (normalizedExtracted[normPlaceholder]) {
                    initialEntities[placeholder] = normalizedExtracted[normPlaceholder];
                } else {
                    unmatchedPlaceholders.push(placeholder);
                    initialEntities[placeholder] = "";
                }
            });

            if (unmatchedPlaceholders.length > 0 && Object.keys(extractedEntities).length > 0) {
                const aiMatchResult = await matchEntitiesToPlaceholders({
                    placeholders: unmatchedPlaceholders,
                    entities: extractedEntities,
                    entityDescriptions,
                });

                aiMatchResult.matches.forEach(({ placeholder, entityKey }) => {
                    if (extractedEntities[entityKey] !== undefined) {
                        initialEntities[placeholder] = String(extractedEntities[entityKey]);
                        aiMatched.add(placeholder);
                    }
                });
            }

            setMatchedByAI(aiMatched);
            setEditableEntities(initialEntities);
        } catch (error) {
            console.error('Error during AI matching:', error);
            const fallbackEntities: Record<string, string> = {};
            requiredPlaceholders.forEach(placeholder => {
                fallbackEntities[placeholder] = "";
            });
            setEditableEntities(fallbackEntities);
        } finally {
            setIsMatching(false);
        }
    }, [extractedEntities, entityDescriptions, requiredPlaceholders]);

    useEffect(() => {
        if (isOpen) {
            performMatching();
        }
    }, [isOpen, performMatching]);

    const handleEntityChange = (key: string, value: string) => {
        setEditableEntities(prev => ({
            ...prev,
            [key]: value,
        }));
    };

    const handleConfirm = () => {
        const filledEntities = Object.entries(editableEntities).reduce((acc, [key, value]) => {
            if (value.trim()) {
                acc[key] = value;
            }
            return acc;
        }, {} as Record<string, any>);

        onConfirm(filledEntities);
    };

    const missingCount = Object.values(editableEntities).filter(v => !v.trim()).length;
    const filledCount = requiredPlaceholders.length - missingCount;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                        <DialogTitle>Revisar e Editar Entidades</DialogTitle>
                        <DialogDescription>
                            Revise as entidades extraídas e preencha manualmente os campos que estão faltando.
                        </DialogDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={performMatching}
                        disabled={isMatching}
                        className="gap-2"
                    >
                        <RefreshCw className={`h-3 w-3 ${isMatching ? 'animate-spin' : ''}`} />
                        {isMatching ? 'Processando...' : 'Re-processar com IA'}
                    </Button>
                </DialogHeader>

                {isMatching ? (
                    <div className="flex items-center justify-center text-sm py-3 px-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin mr-2" />
                        <span className="font-medium text-blue-700 dark:text-blue-400">IA analisando correspondências...</span>
                    </div>
                ) : (
                    <div className="flex items-center justify-between text-sm py-2 px-4 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{filledCount} preenchidas</span>
                            {matchedByAI.size > 0 && (
                                <span className="text-xs text-blue-600 flex items-center gap-1">
                                    <Sparkles className="h-3 w-3" />
                                    {matchedByAI.size} pela IA
                                </span>
                            )}
                        </div>
                        {missingCount > 0 && (
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <span className="font-medium text-amber-600">{missingCount} vazias</span>
                            </div>
                        )}
                    </div>
                )}

                <ScrollArea className="flex-1 rounded-md border bg-card p-4">
                    <div className="space-y-4">
                        {requiredPlaceholders.map(placeholder => {
                            const value = editableEntities[placeholder] || "";
                            const isFilled = !!value.trim();
                            const wasExtractedExact = !!extractedEntities[placeholder];
                            const wasMatchedByAI = matchedByAI.has(placeholder);
                            const wasExtracted = wasExtractedExact || wasMatchedByAI;

                            return (
                                <div key={placeholder} className="grid grid-cols-[1fr,2fr] gap-4 items-center pb-4 border-b last:border-b-0">
                                    <div className="text-right space-y-1">
                                        <Label htmlFor={`entity-${placeholder}`} className="font-mono text-xs text-muted-foreground flex items-center justify-end gap-2">
                                            {placeholder}
                                            {wasExtractedExact && (
                                                <CheckCircle2 className="h-3 w-3 text-green-600" title="Extraída automaticamente (match exato)" />
                                            )}
                                            {wasMatchedByAI && (
                                                <Sparkles className="h-3 w-3 text-blue-600" title="Correspondida pela IA" />
                                            )}
                                        </Label>
                                    </div>
                                    <div>
                                        <Input
                                            id={`entity-${placeholder}`}
                                            value={value}
                                            onChange={(e) => handleEntityChange(placeholder, e.target.value)}
                                            placeholder={wasExtracted ? "Valor extraído" : "Digite o valor manualmente"}
                                            className={
                                                !isFilled
                                                    ? "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                                                    : wasExtracted
                                                        ? "border-green-500/30 bg-green-50 dark:bg-green-950/20"
                                                        : "border-blue-500/30 bg-blue-50 dark:bg-blue-950/20"
                                            }
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>

                <DialogFooter className="mt-auto pt-4 border-t">
                    <Button variant="outline" onClick={onClose} disabled={isMatching}>
                        Cancelar
                    </Button>
                    <Button onClick={handleConfirm} disabled={isMatching}>
                        <Wand2 className="mr-2 h-4 w-4" />
                        Gerar Documentos
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
