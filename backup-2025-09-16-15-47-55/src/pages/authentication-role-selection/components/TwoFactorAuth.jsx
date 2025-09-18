import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';

const TwoFactorAuth = ({ user, onVerify, onSkip, isLoading }) => {
  const [verificationCode, setVerificationCode] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [canResend, setCanResend] = useState(false);

  // Mock QR code generation
  useEffect(() => {
    const mockQrData = `otpauth://totp/Hybits%20CRM:${user?.email || 'user@hybits.com'}?secret=JBSWY3DPEHPK3PXP&issuer=Hybits%20CRM`;
    setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mockQrData)}`);
  }, [user]);

  // Countdown timer for resend
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  const handleVerify = (e) => {
    e?.preventDefault();
    if (verificationCode?.length === 6) {
      onVerify(verificationCode);
    }
  };

  const handleResendCode = () => {
    setTimeLeft(30);
    setCanResend(false);
    // Mock resend logic
    console.log('Resending verification code...');
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs?.toString()?.padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon name="Shield" size={32} color="white" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {isSetupMode ? 'Setup Two-Factor Authentication' : 'Two-Factor Authentication'}
        </h2>
        <p className="text-muted-foreground">
          {isSetupMode 
            ? 'Scan the QR code with your authenticator app and enter the verification code'
            : 'Enter the 6-digit code from your authenticator app'
          }
        </p>
      </div>
      {isSetupMode && (
        <div className="mb-8">
          <div className="bg-white p-6 rounded-lg border border-border text-center">
            <img 
              src={qrCodeUrl} 
              alt="QR Code for 2FA Setup"
              className="mx-auto mb-4"
              width={200}
              height={200}
            />
            <p className="text-sm text-muted-foreground mb-2">
              Can't scan? Enter this code manually:
            </p>
            <code className="bg-muted px-3 py-1 rounded text-sm font-mono">
              JBSWY3DPEHPK3PXP
            </code>
          </div>
        </div>
      )}
      <form onSubmit={handleVerify} className="space-y-6">
        {/* Verification Code Input */}
        <Input
          label="Verification Code"
          type="text"
          placeholder="Enter 6-digit code"
          value={verificationCode}
          onChange={(e) => {
            const value = e?.target?.value?.replace(/\D/g, '')?.slice(0, 6);
            setVerificationCode(value);
          }}
          maxLength={6}
          className="text-center text-2xl tracking-widest font-mono"
          disabled={isLoading}
          required
        />

        {/* Timer and Resend */}
        <div className="text-center">
          {!canResend ? (
            <p className="text-sm text-muted-foreground">
              Resend code in {formatTime(timeLeft)}
            </p>
          ) : (
            <Button
              variant="link"
              size="sm"
              onClick={handleResendCode}
              className="text-primary hover:text-primary/80"
              disabled={isLoading}
            >
              Resend verification code
            </Button>
          )}
        </div>

        {/* Verify Button */}
        <Button
          type="submit"
          variant="default"
          size="lg"
          fullWidth
          loading={isLoading}
          disabled={verificationCode?.length !== 6}
          iconName="Shield"
          iconPosition="left"
        >
          {isLoading ? 'Verifying...' : 'Verify Code'}
        </Button>

        {/* Setup Toggle */}
        {!isSetupMode && (
          <div className="text-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsSetupMode(true)}
              className="text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              Setup new authenticator app
            </Button>
          </div>
        )}

        {/* Skip Option */}
        <div className="text-center">
          <Button
            variant="link"
            size="sm"
            onClick={onSkip}
            className="text-muted-foreground hover:text-foreground"
            disabled={isLoading}
          >
            Skip for now
          </Button>
        </div>
      </form>
      {/* Security Notice */}
      <div className="mt-8 p-4 bg-muted rounded-lg border border-border">
        <div className="flex items-start space-x-3">
          <Icon name="Info" size={16} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">Security Notice</p>
            <p className="text-xs text-muted-foreground mt-1">
              Two-factor authentication adds an extra layer of security to your account. 
              We recommend using apps like Google Authenticator, Authy, or Microsoft Authenticator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TwoFactorAuth;