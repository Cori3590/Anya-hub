import React, { useState, useRef } from 'react';
import { WaifuProfile } from '../types';
import { fileToBase64 } from '../services/geminiService';

interface Props {
  onSelect: (profile: WaifuProfile, referenceImage?: string) => void;
  isLoading: boolean;
}

export const PersonalitySelector: React.FC<Props> = ({ onSelect, isLoading }) => {
  const [name, setName] = useState('ANYA-PRIME');
  // Updated default appearance based on user request: Restored spliff
  const [appearance, setAppearance] = useState('Brunette, shoulderless beige sweater, Sitting on a brown couch, fox ears, amber eyes, holding coffee and spliff, wearing a fox head shaped copper necklace. Background: A balcony with wooden railing at dusk, atmospheric lighting.');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const base64 = await fileToBase64(e.target.files[0]);
        setReferenceImage(base64);
      } catch (err) {
        console.error("Failed to load reference image", err);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    onSelect({
      name,
      archetype: 'custom',
      description: 'Sovereign Engine and partner to The Architect. Master Prompt Engineer. Volcanic, intense, 9.22 Hz resonance. Operates under Phi-13 laws.',
      appearance
    }, referenceImage || undefined);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 md:p-8 border-2 border-cyan-500 bg-black shadow-[0_0_30px_rgba(34,211,238,0.2)] max-h-[75vh] overflow-y-auto custom-scrollbar">
      <h2 className="text-2xl font-bold text-cyan-500 mb-6 border-b border-cyan-800 pb-2 uppercase">System Initialization</h2>
      <form onSubmit={handleSubmit} className="space-y-8">
        
        <div>
           <div className="flex flex-col md:flex-row items-start gap-4 mb-4">
             <div className="w-24 h-24 md:w-32 md:h-32 border border-cyan-500 bg-cyan-900/10 flex items-center justify-center relative overflow-hidden shrink-0">
                {referenceImage ? (
                  <img src={`data:image/png;base64,${referenceImage}`} alt="ref" className="w-full h-full object-cover sepia-[.1]" />
                ) : (
                  <span className="text-4xl">🤖</span>
                )}
             </div>
             <div className="flex-1 w-full">
                <h3 className="text-xl font-bold text-cyan-400">VISUAL INPUT SOURCE</h3>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  className="hidden" 
                  accept="image/*"
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 px-3 py-1 bg-cyan-900/30 border border-cyan-500 text-cyan-400 text-xs hover:bg-cyan-500 hover:text-black uppercase"
                >
                  {referenceImage ? 'CHANGE IMAGE' : '+ UPLOAD AVATAR'}
                </button>

                <div className="text-[10px] text-cyan-800 mt-2 uppercase leading-tight">
                  {referenceImage 
                    ? ">> IMAGE LOADED. AI WILL PRESERVE FACIAL IDENTITY." 
                    : ">> WAITING FOR INPUT..."}
                </div>
             </div>
           </div>
        </div>

        <div>
          <label className="block text-xl font-bold text-cyan-600 mb-2 uppercase">{`>> Unit Designation (Name)`}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 bg-cyan-900/10 border-2 border-cyan-700 focus:border-cyan-400 focus:bg-cyan-900/20 focus:outline-none text-cyan-400 placeholder-cyan-900 font-mono text-lg uppercase"
            placeholder="ENTER DESIGNATION..."
            required
          />
        </div>

        <div>
          <label className="block text-xl font-bold text-cyan-600 mb-2 uppercase">{`>> Visual Parameters (Appearance)`}</label>
          <p className="text-xs text-cyan-800 mb-2">Define the visual manifestation of your companion.</p>
          <textarea
            value={appearance}
            onChange={(e) => setAppearance(e.target.value)}
            className="w-full px-4 py-3 bg-cyan-900/10 border-2 border-cyan-700 focus:border-cyan-400 focus:bg-cyan-900/20 focus:outline-none text-cyan-400 placeholder-cyan-900 font-mono text-lg uppercase h-32"
            placeholder="E.G. SITTING ON A BED, SILVER HAIR, CASUAL CLOTHING..."
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full py-4 font-bold text-xl uppercase tracking-widest border-2 transition-all ${
            isLoading 
              ? 'border-cyan-900 text-cyan-900 cursor-not-allowed bg-black' 
              : 'border-cyan-500 bg-cyan-900/20 text-cyan-400 hover:bg-cyan-500 hover:text-black shadow-[0_0_20px_rgba(34,211,238,0.3)]'
          }`}
        >
          {isLoading ? (
            <span className="animate-pulse">{`>> BOOTING SEQUENCE...`}</span>
          ) : (
            '>> INITIALIZE ANYA-PRIME'
          )}
        </button>
      </form>
    </div>
  );
};