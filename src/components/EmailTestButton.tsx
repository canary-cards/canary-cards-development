import React from 'react';
import { Button } from './ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const EmailTestButton = () => {
  const testEmailSend = async () => {
    try {
      const baseTestData = {
        representative: {
          name: "Doris Matsui",
          state: "CA",
          party: "Democrat",
          type: "representative"
        },
        senators: [
          {"name": "Alex Padilla", "state": "CA", "party": "Democrat"},
          {"name": "Laphonza Butler", "state": "CA", "party": "Democrat"}
        ],
        sendOption: "triple",
        orderResults: [
          {"type": "representative", "recipient": "Doris Matsui", "orderId": "TEST-001", "status": "success"},
          {"type": "senator", "recipient": "Alex Padilla", "orderId": "TEST-002", "status": "success"},
          {"type": "senator", "recipient": "Laphonza Butler", "orderId": "TEST-003", "status": "success"}
        ],
        finalMessage: "Dear Rep. Matsui,\n\nI am writing to you as your constituent from Sacramento, California. As someone who cares deeply about our community and our nation's future, I want to share my thoughts on an issue that's important to me.\n\nClimate change continues to be one of the most pressing challenges of our time. I've seen the impacts firsthand in our state - from devastating wildfires to extreme weather events. I believe we need bold action to transition to clean energy and protect our environment for future generations.\n\nI urge you to support legislation that invests in renewable energy infrastructure, creates good-paying green jobs, and holds polluters accountable. The time for incremental change has passed - we need transformative action now.\n\nThank you for your time and consideration. I look forward to seeing your leadership on this critical issue.\n\nSincerely,\n[First Name] [Last Name]"
      };

      const recipients = [
        {
          fullName: "Test User",
          email: "bwolfgang13@gmail.com",
          streetAddress: "123 Main St",
          city: "Sacramento",
          state: "CA",
          zipCode: "95814"
        },
        {
          fullName: "Toby Myers",
          email: "toby.isaac.myers@gmail.com",
          streetAddress: "456 Oak Ave",
          city: "Sacramento", 
          state: "CA",
          zipCode: "95814"
        }
      ];

      console.log('Sending test emails to both recipients...');
      
      const emailPromises = recipients.map(async (userInfo) => {
        const testData = { ...baseTestData, userInfo };
        console.log('Sending test email to:', userInfo.email);
        
        return await supabase.functions.invoke('send-order-confirmation', {
          body: testData
        });
      });

      const results = await Promise.all(emailPromises);
      
      let successCount = 0;
      let errorCount = 0;
      
      results.forEach((result, index) => {
        if (result.error) {
          console.error(`Email test error for ${recipients[index].email}:`, result.error);
          errorCount++;
        } else {
          console.log(`Email test success for ${recipients[index].email}:`, result.data);
          successCount++;
        }
      });

      if (errorCount === 0) {
        toast.success(`Test emails sent successfully to both recipients!`);
      } else if (successCount > 0) {
        toast.success(`${successCount} test email(s) sent successfully, ${errorCount} failed`);
      } else {
        toast.error('All test emails failed to send');
      }
    } catch (error) {
      console.error('Email test exception:', error);
      toast.error('Failed to send test emails');
    }
  };

  return (
    <Button 
      onClick={testEmailSend}
      variant="outline"
      className="bg-yellow-100 border-yellow-300 text-yellow-800 hover:bg-yellow-200"
    >
      🧪 Send Test Email
    </Button>
  );
};